import { NextResponse } from "next/server";
import { prisma, inParams } from "@/lib/prisma";
import { getCurrentSeasonKey } from "@/lib/season";
import { requireAdmin } from "@/lib/admin-auth";

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function getRoundName(totalRounds: number, roundIndex: number): string {
  const remaining = totalRounds - roundIndex;
  if (remaining === 0) return "Finale";
  if (remaining === 1) return "Demi-finales";
  if (remaining === 2) return "Quarts de finale";
  if (remaining === 3) return "Huitièmes de finale";
  if (remaining === 4) return "Seizièmes de finale";
  return `Tour ${roundIndex + 1}`;
}

// GET: cup state
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const cupId = Number(searchParams.get("cupId") ?? 0);

  if (cupId) {
    // Get specific cup with matches
    const cup = await prisma.$queryRawUnsafe<{ id: number; name: string; status: string }[]>(
      "SELECT id, name, status FROM CUP WHERE id = ?", cupId
    );
    if (cup.length === 0) return NextResponse.json({ error: "Coupe non trouvée" }, { status: 404 });

    const matches = await prisma.$queryRawUnsafe<{
      id: number; round: string; position: number; matchday: number | null;
      user1_id: number | null; user2_id: number | null;
      score1: number | null; score2: number | null;
      avg1: number | null; avg2: number | null;
      winner_id: number | null;
    }[]>(
      "SELECT * FROM CUP_MATCH WHERE cup_id = ? ORDER BY position", cupId
    );

    // Get user names
    const userIds = Array.from(new Set(matches.flatMap((m) => [m.user1_id, m.user2_id].filter(Boolean))));
    const users = userIds.length > 0
      ? await (async () => { const [ph, vs] = inParams(userIds as number[]); return prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
          `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${ph})`, ...vs); })()
      : [];
    const userMap = new Map(users.map((u) => [Number(u.ID_USER), (u.NAME ?? "").replace(/<[^>]*>/g, "").trim()]));

    return NextResponse.json({
      cup: { id: Number(cup[0].id), name: cup[0].name, status: cup[0].status },
      matches: matches.map((m) => ({
        id: Number(m.id),
        round: m.round,
        position: Number(m.position),
        matchday: m.matchday ? Number(m.matchday) : null,
        user1: m.user1_id ? { id: Number(m.user1_id), name: userMap.get(Number(m.user1_id)) ?? "?" } : null,
        user2: m.user2_id ? { id: Number(m.user2_id), name: userMap.get(Number(m.user2_id)) ?? "?" } : null,
        score1: m.score1 !== null ? Number(m.score1) : null,
        score2: m.score2 !== null ? Number(m.score2) : null,
        avg1: m.avg1 !== null ? Number(m.avg1) : null,
        avg2: m.avg2 !== null ? Number(m.avg2) : null,
        winnerId: m.winner_id ? Number(m.winner_id) : null,
        winnerName: m.winner_id ? userMap.get(Number(m.winner_id)) : null,
      })),
    });
  }

  // List all cups
  const cups = await prisma.$queryRawUnsafe<{ id: number; name: string; status: string; season: string }[]>(
    "SELECT * FROM CUP ORDER BY id DESC"
  );
  return NextResponse.json({
    cups: cups.map((c) => ({ id: Number(c.id), name: c.name, status: c.status, season: c.season })),
  });
}

// POST: actions
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { action } = body as { action: string };

  if (action === "create-draw") {
    const { matchdays, participantIds, season } = body as {
      action: string;
      matchdays?: Record<string, number>;
      participantIds?: number[];
      season?: string;
    };

    // Check if an active cup already exists
    const activeCups = await prisma.$queryRawUnsafe<{ id: number }[]>(
      "SELECT id FROM CUP WHERE status = 'active' LIMIT 1"
    );
    if (activeCups.length > 0) {
      return NextResponse.json(
        { error: "Une coupe active existe déjà. Supprimez-la d'abord." },
        { status: 400 }
      );
    }

    // Get participants: either from selection or all
    let userIds: number[];
    if (participantIds && participantIds.length > 0) {
      userIds = participantIds;
    } else {
      const participants = await prisma.$queryRawUnsafe<{ ID_USER: number }[]>(
        "SELECT DISTINCT ID_USER FROM LEAGUE_USER WHERE ID_LEAGUE > 0"
      );
      userIds = participants.map((p) => Number(p.ID_USER));
    }
    const cupSeason = season ?? (await getCurrentSeasonKey());
    const total = userIds.length;

    // Shuffle for random draw
    for (let i = userIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [userIds[i], userIds[j]] = [userIds[j], userIds[i]];
    }

    const bracketSize = nextPowerOf2(total);
    const prelimCount = total - bracketSize / 2; // number of players needing prelim

    // Create cup
    await prisma.$executeRawUnsafe(
      "INSERT INTO CUP (name, season, status) VALUES ('Coupe de France', ?, 'active')",
      cupSeason
    );
    const [cupRow] = await prisma.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() as id");
    const cupId = Number(cupRow.id);

    let roundIndex = 0;
    let position = 1;

    if (prelimCount > 0) {
      // Preliminary round: first 2*prelimCount players play, rest get byes
      const roundName = "Tour préliminaire";
      const md = matchdays?.[roundName] ?? null;

      for (let i = 0; i < prelimCount; i++) {
        await prisma.$executeRawUnsafe(
          "INSERT INTO CUP_MATCH (cup_id, round, position, matchday, user1_id, user2_id) VALUES (?, ?, ?, ?, ?, ?)",
          cupId, roundName, position++, md, userIds[i * 2], userIds[i * 2 + 1]
        );
      }
      roundIndex++;
    }

    // Main bracket rounds
    const mainSize = bracketSize / 2;
    let matchesInRound = mainSize;
    let currentRound = roundIndex;

    while (matchesInRound >= 1) {
      const roundName = getRoundName(
        Math.log2(bracketSize) + (prelimCount > 0 ? 1 : 0),
        currentRound
      );
      const md = matchdays?.[roundName] ?? null;

      if (currentRound === roundIndex && prelimCount > 0) {
        // First main round: prelim winners + byes
        const byeStart = prelimCount * 2;
        let matchIdx = 0;

        // Prelim winners slots
        for (let i = 0; i < prelimCount; i++) {
          const byeUserId = byeStart + matchIdx < userIds.length ? userIds[byeStart + matchIdx] : null;
          await prisma.$executeRawUnsafe(
            "INSERT INTO CUP_MATCH (cup_id, round, position, matchday, user1_id, user2_id) VALUES (?, ?, ?, ?, NULL, ?)",
            cupId, roundName, position++, md, byeUserId
          );
          matchIdx++;
        }

        // Remaining byes vs byes
        while (matchIdx < mainSize - prelimCount) {
          const u1 = byeStart + matchIdx < userIds.length ? userIds[byeStart + matchIdx] : null;
          matchIdx++;
          const u2 = byeStart + matchIdx < userIds.length ? userIds[byeStart + matchIdx] : null;
          matchIdx++;
          await prisma.$executeRawUnsafe(
            "INSERT INTO CUP_MATCH (cup_id, round, position, matchday, user1_id, user2_id) VALUES (?, ?, ?, ?, ?, ?)",
            cupId, roundName, position++, md, u1, u2
          );
        }
      } else if (currentRound > roundIndex || prelimCount === 0) {
        // Later rounds or no prelim: empty slots for winners
        if (currentRound === 0 && prelimCount === 0) {
          // First round, no prelim: pair everyone
          for (let i = 0; i < matchesInRound; i++) {
            const u1 = i * 2 < userIds.length ? userIds[i * 2] : null;
            const u2 = i * 2 + 1 < userIds.length ? userIds[i * 2 + 1] : null;
            await prisma.$executeRawUnsafe(
              "INSERT INTO CUP_MATCH (cup_id, round, position, matchday, user1_id, user2_id) VALUES (?, ?, ?, ?, ?, ?)",
              cupId, roundName, position++, md, u1, u2
            );
          }
        } else {
          // Empty matches for future rounds
          for (let i = 0; i < matchesInRound; i++) {
            await prisma.$executeRawUnsafe(
              "INSERT INTO CUP_MATCH (cup_id, round, position, matchday) VALUES (?, ?, ?, ?)",
              cupId, roundName, position++, md
            );
          }
        }
      }

      matchesInRound = Math.floor(matchesInRound / 2);
      currentRound++;
    }

    return NextResponse.json({ ok: true, cupId, message: `Coupe créée : ${total} participants, tirage au sort effectué` });
  }

  if (action === "resolve-round") {
    const { cupId, round } = body as { action: string; cupId: number; round: string };

    // Check if petit poucet is enabled
    const [cupRow] = await prisma.$queryRawUnsafe<{ petit_poucet: number }[]>(
      "SELECT petit_poucet FROM CUP WHERE id = ?", cupId
    );
    const petitPoucet = cupRow?.petit_poucet === 1;

    // Two rank maps:
    //  - intraLeagueRank: rank within each user's own league (1-18) -> used for petit poucet bonus
    //  - interLeagueRank: rank across all leagues (1-54) -> used as 2nd tiebreak when scores AND avg are equal
    const intraLeagueRank = new Map<number, number>();
    const leagueStats = await prisma.$queryRawUnsafe<{ userId: number; leagueId: number; total: number }[]>(
      `SELECT s.ID_USER as userId, s.ID_LEAGUE as leagueId, SUM(s.PTS_TOT) as total
       FROM STATS_USER s WHERE s.ID_LEAGUE > 0
       GROUP BY s.ID_USER, s.ID_LEAGUE`
    );
    const byLeague = new Map<number, { userId: number; total: number }[]>();
    leagueStats.forEach((s) => {
      const lid = Number(s.leagueId);
      if (!byLeague.has(lid)) byLeague.set(lid, []);
      byLeague.get(lid)!.push({ userId: Number(s.userId), total: Number(s.total) });
    });
    byLeague.forEach((users) => {
      users.sort((a, b) => b.total - a.total);
      users.forEach((u, i) => intraLeagueRank.set(u.userId, i + 1));
    });

    const interLeagueRank = new Map<number, number>();
    const allStats = await prisma.$queryRawUnsafe<{ userId: number; total: number }[]>(
      `SELECT s.ID_USER as userId, SUM(s.PTS_TOT) as total
       FROM STATS_USER s WHERE s.ID_LEAGUE > 0
       GROUP BY s.ID_USER ORDER BY total DESC`
    );
    allStats.forEach((s, i) => interLeagueRank.set(Number(s.userId), i + 1));

    // Get matches for this round
    const matches = await prisma.$queryRawUnsafe<{
      id: number; position: number; user1_id: number | null; user2_id: number | null; matchday: number | null;
    }[]>(
      "SELECT id, position, user1_id, user2_id, matchday FROM CUP_MATCH WHERE cup_id = ? AND round = ? AND winner_id IS NULL",
      cupId, round
    );

    let resolved = 0;
    for (const match of matches) {
      if (!match.user1_id || !match.user2_id || !match.matchday) continue;

      // Get day scores for both users
      const [s1] = await prisma.$queryRawUnsafe<{ pts: number; player_used: number }[]>(
        "SELECT COALESCE(SUM(PTS_TOT),0) as pts, COALESCE(SUM(PLAYER_USED),0) as player_used FROM STATS_USER WHERE ID_USER = ? AND DAY = ?",
        match.user1_id, match.matchday
      );
      const [s2] = await prisma.$queryRawUnsafe<{ pts: number; player_used: number }[]>(
        "SELECT COALESCE(SUM(PTS_TOT),0) as pts, COALESCE(SUM(PLAYER_USED),0) as player_used FROM STATS_USER WHERE ID_USER = ? AND DAY = ?",
        match.user2_id, match.matchday
      );

      let pts1 = Number(s1.pts);
      let pts2 = Number(s2.pts);
      const used1 = Number(s1.player_used) || 11;
      const used2 = Number(s2.player_used) || 11;

      // Petit Poucet: bonus for the player with the worse intra-league rank.
      // Bonus = floor(|rank1 - rank2| / 2). No bonus if a user has no rank yet.
      if (petitPoucet) {
        const rank1 = intraLeagueRank.get(Number(match.user1_id));
        const rank2 = intraLeagueRank.get(Number(match.user2_id));
        if (rank1 !== undefined && rank2 !== undefined) {
          const diff = Math.abs(rank1 - rank2);
          const bonus = Math.floor(diff / 2);
          if (rank1 > rank2) pts1 += bonus; // user1 is lower ranked
          else if (rank2 > rank1) pts2 += bonus; // user2 is lower ranked
        }
      }

      const avg1 = pts1 / used1;
      const avg2 = pts2 / used2;

      let winnerId: number;
      if (pts1 !== pts2) {
        winnerId = pts1 > pts2 ? Number(match.user1_id) : Number(match.user2_id);
      } else if (avg1 !== avg2) {
        // 1st tiebreak: avg points per player
        winnerId = avg1 > avg2 ? Number(match.user1_id) : Number(match.user2_id);
      } else {
        // 2nd tiebreak: better interligue rank wins (lower rank = better)
        const rank1 = interLeagueRank.get(Number(match.user1_id)) ?? 99;
        const rank2 = interLeagueRank.get(Number(match.user2_id)) ?? 99;
        winnerId = rank1 <= rank2 ? Number(match.user1_id) : Number(match.user2_id);
      }

      await prisma.$executeRawUnsafe(
        "UPDATE CUP_MATCH SET score1 = ?, score2 = ?, avg1 = ?, avg2 = ?, winner_id = ? WHERE id = ?",
        pts1, pts2, avg1, avg2, winnerId, Number(match.id)
      );

      // Advance winner to next round
      // Bracket logic: match at position P feeds into the next round.
      // Pairs (P, P+1) go to the same target match. Even P = user1, odd P = user2.
      const pos = Number(match.position);
      // For paired matches, both pos P and P+1 feed into the same target
      // We need to find the correct target: skip floor((pos - roundStartPos) / 2) matches into next round
      const roundMatches = await prisma.$queryRawUnsafe<{ position: number }[]>(
        "SELECT position FROM CUP_MATCH WHERE cup_id = ? AND round = ? ORDER BY position",
        cupId, round
      );
      const roundStartPos = roundMatches.length > 0 ? Number(roundMatches[0].position) : pos;
      const offsetInRound = pos - roundStartPos;
      const targetOffset = Math.floor(offsetInRound / 2);

      const nextRoundMatches = await prisma.$queryRawUnsafe<{ id: number; position: number }[]>(
        "SELECT id, position FROM CUP_MATCH WHERE cup_id = ? AND position > ? AND round != ? ORDER BY position",
        cupId, Math.max(...roundMatches.map(r => Number(r.position))), round
      );

      if (nextRoundMatches.length > targetOffset) {
        const target = nextRoundMatches[targetOffset];
        const slot = offsetInRound % 2 === 0 ? "user1_id" : "user2_id";
        await prisma.$executeRawUnsafe(
          `UPDATE CUP_MATCH SET ${slot} = ? WHERE id = ?`,
          winnerId, Number(target.id)
        );
      }

      resolved++;
    }

    return NextResponse.json({ ok: true, message: `${resolved} match(s) résolu(s) pour ${round}` });
  }

  if (action === "set-matchday") {
    const { cupId, round, matchday } = body as { action: string; cupId: number; round: string; matchday: number };
    await prisma.$executeRawUnsafe(
      "UPDATE CUP_MATCH SET matchday = ? WHERE cup_id = ? AND round = ?",
      matchday, cupId, round
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "reset-round") {
    const { cupId, round } = body as { action: string; cupId: number; round: string };

    // Get the winners from this round before resetting
    const roundMatches = await prisma.$queryRawUnsafe<{
      id: number; winner_id: number | null;
    }[]>(
      "SELECT id, winner_id FROM CUP_MATCH WHERE cup_id = ? AND round = ?",
      cupId, round
    );

    const winnerIds = roundMatches.map((m) => m.winner_id).filter(Boolean) as number[];

    // Reset scores and winners for this round
    await prisma.$executeRawUnsafe(
      "UPDATE CUP_MATCH SET score1 = NULL, score2 = NULL, avg1 = NULL, avg2 = NULL, winner_id = NULL WHERE cup_id = ? AND round = ?",
      cupId, round
    );

    // Remove these winners from the next round slots
    if (winnerIds.length > 0) {
      // Get all rounds in order
      const allRounds = await prisma.$queryRawUnsafe<{ round: string; min_pos: number }[]>(
        "SELECT round, MIN(position) as min_pos FROM CUP_MATCH WHERE cup_id = ? GROUP BY round ORDER BY min_pos",
        cupId
      );
      const roundNames = allRounds.map((r) => r.round);
      const currentIdx = roundNames.indexOf(round);
      if (currentIdx >= 0 && currentIdx < roundNames.length - 1) {
        const nextRound = roundNames[currentIdx + 1];
        for (const wId of winnerIds) {
          await prisma.$executeRawUnsafe(
            "UPDATE CUP_MATCH SET user1_id = NULL WHERE cup_id = ? AND round = ? AND user1_id = ?",
            cupId, nextRound, wId
          );
          await prisma.$executeRawUnsafe(
            "UPDATE CUP_MATCH SET user2_id = NULL WHERE cup_id = ? AND round = ? AND user2_id = ?",
            cupId, nextRound, wId
          );
        }
      }
    }

    return NextResponse.json({ ok: true, message: `Tour "${round}" réinitialisé` });
  }

  if (action === "delete-cup") {
    const { cupId } = body as { action: string; cupId: number };

    await prisma.$executeRawUnsafe("DELETE FROM CUP_MATCH WHERE cup_id = ?", cupId);
    await prisma.$executeRawUnsafe("DELETE FROM CUP WHERE id = ?", cupId);

    return NextResponse.json({ ok: true, message: "Coupe supprimée" });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
