import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
      ? await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
          `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${userIds.join(",")})`)
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
    // Create cup + draw entire bracket
    const { matchdays } = body as { action: string; matchdays: Record<string, number> };

    // Get all participants
    const participants = await prisma.$queryRawUnsafe<{ ID_USER: number }[]>(
      "SELECT DISTINCT ID_USER FROM LEAGUE_USER WHERE ID_LEAGUE > 0"
    );
    const userIds = participants.map((p) => Number(p.ID_USER));
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
      "INSERT INTO CUP (name, season, status) VALUES ('Coupe de France', '2025-2026', 'active')"
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

    // Get matches for this round
    const matches = await prisma.$queryRawUnsafe<{
      id: number; user1_id: number | null; user2_id: number | null; matchday: number | null;
    }[]>(
      "SELECT id, user1_id, user2_id, matchday FROM CUP_MATCH WHERE cup_id = ? AND round = ? AND winner_id IS NULL",
      cupId, round
    );

    let resolved = 0;
    for (const match of matches) {
      if (!match.user1_id || !match.user2_id || !match.matchday) continue;

      // Get day scores for both users (from STATS_USER, sum across all leagues)
      const [s1] = await prisma.$queryRawUnsafe<{ pts: number; player_used: number }[]>(
        "SELECT COALESCE(SUM(PTS_TOT),0) as pts, COALESCE(SUM(PLAYER_USED),0) as player_used FROM STATS_USER WHERE ID_USER = ? AND DAY = ?",
        match.user1_id, match.matchday
      );
      const [s2] = await prisma.$queryRawUnsafe<{ pts: number; player_used: number }[]>(
        "SELECT COALESCE(SUM(PTS_TOT),0) as pts, COALESCE(SUM(PLAYER_USED),0) as player_used FROM STATS_USER WHERE ID_USER = ? AND DAY = ?",
        match.user2_id, match.matchday
      );

      const pts1 = Number(s1.pts);
      const pts2 = Number(s2.pts);
      const used1 = Number(s1.player_used) || 11;
      const used2 = Number(s2.player_used) || 11;
      const avg1 = pts1 / used1;
      const avg2 = pts2 / used2;

      let winnerId: number;
      if (pts1 !== pts2) {
        winnerId = pts1 > pts2 ? Number(match.user1_id) : Number(match.user2_id);
      } else {
        // Tiebreak: avg points per player
        winnerId = avg1 >= avg2 ? Number(match.user1_id) : Number(match.user2_id);
      }

      await prisma.$executeRawUnsafe(
        "UPDATE CUP_MATCH SET score1 = ?, score2 = ?, avg1 = ?, avg2 = ?, winner_id = ? WHERE id = ?",
        pts1, pts2, avg1, avg2, winnerId, Number(match.id)
      );

      // Advance winner to next round
      const nextMatch = await prisma.$queryRawUnsafe<{ id: number; user1_id: number | null }[]>(
        "SELECT id, user1_id FROM CUP_MATCH WHERE cup_id = ? AND position > ? AND (user1_id IS NULL OR user2_id IS NULL) ORDER BY position LIMIT 1",
        cupId, Number(match.id)
      );

      if (nextMatch.length > 0) {
        const field = nextMatch[0].user1_id === null ? "user1_id" : "user2_id";
        await prisma.$executeRawUnsafe(
          `UPDATE CUP_MATCH SET ${field} = ? WHERE id = ?`,
          winnerId, Number(nextMatch[0].id)
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

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
