import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSeasonKey } from "@/lib/season";
import { requireAdmin } from "@/lib/admin-auth";
import { getLeagues } from "@/lib/db";
import { getJokerEffectDay, applyJokerSwap } from "@/lib/joker-day";
import { postJokerToForum } from "@/lib/joker-forum";

// GET: get squad + joker usage for a participant
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  const userId = Number(searchParams.get("userId") ?? 0);

  if (!leagueId || !userId) {
    return NextResponse.json({ error: "leagueId and userId required" }, { status: 400 });
  }

  // Effectif affiché = celui de la journée d'effet calculée (cutoff 18h la
  // veille du premier match, cf src/lib/joker-day-core.ts).
  const { effectDay, cutoff, currentDay } = await getJokerEffectDay();
  const rosterDay = effectDay;

  // Get current squad (roster actif pour la prochaine journée)
  const squad = await prisma.team.findMany({
    where: {
      leagueId, userId,
      dayFirst: { lte: rosterDay },
      dayLast: { gte: rosterDay },
    },
  });

  const playerIds = squad.map((s) => s.playerId);
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const clubs = await prisma.club.findMany();
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));

  const squadData = squad.map((s) => {
    const p = playerMap.get(s.playerId);
    return {
      playerId: s.playerId,
      name: p ? `${p.fname} ${p.lname}`.trim() : `Player ${s.playerId}`,
      position: p?.position ?? "",
      clubName: p ? (clubMap.get(p.clubId) ?? "") : "",
      isSubs: s.isSubs === 1,
      dayFirst: s.dayFirst,
    };
  });

  // Get joker log entries (full history for this user in this league)
  const jokerLogEntries = await prisma.$queryRawUnsafe<{
    id: number; league_id: number; user_id: number;
    player_out_id: number; player_in_id: number; day: number;
  }[]>(
    "SELECT id, league_id, user_id, player_out_id, player_in_id, day FROM JOKER_LOG WHERE league_id = ? AND user_id = ? ORDER BY id DESC",
    leagueId, userId
  );
  const jokerUsed = jokerLogEntries.length;

  // Resolve player names for joker history
  const jokerPlayerIds = new Set<number>();
  jokerLogEntries.forEach((j) => {
    jokerPlayerIds.add(Number(j.player_out_id));
    jokerPlayerIds.add(Number(j.player_in_id));
  });
  const jokerPlayers = jokerPlayerIds.size > 0
    ? await prisma.player.findMany({ where: { id: { in: Array.from(jokerPlayerIds) } } })
    : [];
  const jokerPlayerMap = new Map(jokerPlayers.map((p) => [p.id, `${p.fname} ${p.lname}`.trim()]));

  const jokerHistory = jokerLogEntries.map((j) => ({
    id: Number(j.id),
    playerOutId: Number(j.player_out_id),
    playerOutName: jokerPlayerMap.get(Number(j.player_out_id)) ?? `#${j.player_out_id}`,
    playerInId: Number(j.player_in_id),
    playerInName: jokerPlayerMap.get(Number(j.player_in_id)) ?? `#${j.player_in_id}`,
    day: Number(j.day),
  }));

  // Get joker config (max allowed)
  const configs = await prisma.$queryRawUnsafe<{ type: string; max_count: number; deadline: string | null; is_active: number }[]>(
    "SELECT type, max_count, deadline, is_active FROM JOKER_CONFIG WHERE season = ? AND is_active = 1",
    await getCurrentSeasonKey()
  );
  const totalMax = configs.reduce((sum, c) => {
    // Summer jokers: only count if before deadline
    if (c.deadline && new Date(c.deadline) < new Date()) return sum;
    return sum + Number(c.max_count);
  }, 0);

  return NextResponse.json({
    squad: squadData,
    jokersUsed: jokerUsed,
    jokersRemaining: totalMax - jokerUsed,
    jokerHistory,
    currentDay,
    effectDay,
    effectCutoff: cutoff ? cutoff.toISOString() : null,
  });
}

// DELETE: cancel/undo a joker
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { jokerLogId } = await request.json() as { jokerLogId: number };

    if (!jokerLogId) {
      return NextResponse.json({ error: "jokerLogId required" }, { status: 400 });
    }

    // Get the joker log entry
    const entries = await prisma.$queryRawUnsafe<{
      id: number; league_id: number; user_id: number;
      player_out_id: number; player_in_id: number; day: number;
    }[]>(
      "SELECT id, league_id, user_id, player_out_id, player_in_id, day FROM JOKER_LOG WHERE id = ?",
      jokerLogId
    );

    if (entries.length === 0) {
      return NextResponse.json({ error: "Joker log entry not found" }, { status: 404 });
    }

    const entry = entries[0];
    const leagueId = Number(entry.league_id);
    const userId = Number(entry.user_id);
    const playerOutId = Number(entry.player_out_id);
    const playerInId = Number(entry.player_in_id);
    const jokerDay = Number(entry.day);

    // 1. Restore the old player: set DAY_LAST back to 38
    //    The old player's stint was ended at jokerDay, so we restore it
    await prisma.$executeRawUnsafe(
      "UPDATE TEAM SET DAY_LAST = 38 WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY_LAST = ?",
      leagueId, userId, playerOutId, jokerDay
    );

    // 2. Remove the new player entry (was inserted with DAY_FIRST = jokerDay + 1)
    await prisma.$executeRawUnsafe(
      "DELETE FROM TEAM WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY_FIRST = ?",
      leagueId, userId, playerInId, jokerDay + 1
    );

    // 3. Delete the JOKER_LOG entry
    await prisma.$executeRawUnsafe(
      "DELETE FROM JOKER_LOG WHERE id = ?",
      jokerLogId
    );

    // Get player names for confirmation
    const [playerOut, playerIn] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerOutId } }),
      prisma.player.findUnique({ where: { id: playerInId } }),
    ]);

    const outName = playerOut ? `${playerOut.fname} ${playerOut.lname}`.trim() : `#${playerOutId}`;
    const inName = playerIn ? `${playerIn.fname} ${playerIn.lname}`.trim() : `#${playerInId}`;

    return NextResponse.json({
      ok: true,
      message: `Joker annule : ${outName} revient, ${inName} retire de l'effectif`,
    });
  } catch (error) {
    console.error("Joker cancel error:", error);
    return NextResponse.json({ error: "Erreur lors de l'annulation" }, { status: 500 });
  }
}

// POST: execute joker swap
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { leagueId, userId, playerOutId, playerInId, day: overrideDay } = await request.json() as {
      leagueId: number;
      userId: number;
      playerOutId: number;
      playerInId: number;
      day?: number;
    };

    if (!leagueId || !userId || !playerOutId || !playerInId) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    // `day` = journée D'EFFET choisie par l'admin (« effectif à partir de J<d> »),
    // sans plafond à la dernière publiée : l'ancien plafond renvoyait tout
    // joker ressaisi « en J2 » sur la J1 tant que la J1 n'était pas publiée
    // (constaté par Pierre le 2026-08-21). Sans choix : journée d'effet
    // calculée (cutoff 18h la veille du premier match).
    const nextDay = overrideDay && overrideDay >= 1 && overrideDay <= 38
      ? Math.floor(overrideDay)
      : (await getJokerEffectDay()).effectDay;

    // Check joker limit from config
    const jokerCount = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      "SELECT COUNT(*) as cnt FROM JOKER_LOG WHERE league_id = ? AND user_id = ?",
      leagueId, userId
    );
    const used = Number(jokerCount[0]?.cnt ?? 0);

    const configs = await prisma.$queryRawUnsafe<{ max_count: number; deadline: string | null }[]>(
      "SELECT max_count, deadline FROM JOKER_CONFIG WHERE season = ? AND is_active = 1",
      await getCurrentSeasonKey()
    );
    const maxJokers = configs.reduce((sum, c) => {
      if (c.deadline && new Date(c.deadline) < new Date()) return sum;
      return sum + Number(c.max_count);
    }, 0);

    if (used >= maxJokers) {
      return NextResponse.json({ error: `Plus de jokers disponibles (${used}/${maxJokers} utilisés)` }, { status: 400 });
    }

    // Validate: playerOut is in this user's squad — au jour d'effet (nextDay),
    // pour fonctionner aussi en avant-saison (currentDay=0, effectif dès J1).
    const outEntry = await prisma.team.findFirst({
      where: {
        leagueId, userId, playerId: playerOutId,
        dayFirst: { lte: nextDay },
        dayLast: { gte: nextDay },
      },
    });
    if (!outEntry) {
      return NextResponse.json({ error: "Ce joueur n'est pas dans l'effectif" }, { status: 400 });
    }

    // Validate: playerIn is free (not in any squad in this league) — au jour d'effet.
    const taken = await prisma.team.findFirst({
      where: {
        leagueId,
        playerId: playerInId,
        dayFirst: { lte: nextDay },
        dayLast: { gte: nextDay },
      },
    });
    if (taken) {
      return NextResponse.json({ error: "Ce joueur est déjà pris par un autre participant" }, { status: 400 });
    }

    await applyJokerSwap({
      leagueId, userId, playerOutId, playerInId,
      outDayFirst: outEntry.dayFirst, isSubs: outEntry.isSubs, effectDay: nextDay,
    });

    // Get player names for confirmation
    const [playerOut, playerIn] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerOutId } }),
      prisma.player.findUnique({ where: { id: playerInId } }),
    ]);

    const outName = playerOut ? `${playerOut.fname} ${playerOut.lname}`.trim() : `#${playerOutId}`;
    const inName = playerIn ? `${playerIn.fname} ${playerIn.lname}`.trim() : `#${playerInId}`;
    const outClub = playerOut ? (await prisma.club.findUnique({ where: { id: playerOut.clubId } }))?.name ?? "" : "";
    const inClub = playerIn ? (await prisma.club.findUnique({ where: { id: playerIn.clubId } }))?.name ?? "" : "";

    // Get user name for forum post
    const userRows = await prisma.$queryRawUnsafe<{ NAME: string }[]>(
      "SELECT NAME FROM USER WHERE ID_USER = ?", userId
    );
    const userName = (userRows[0]?.NAME ?? "").replace(/<[^>]*>/g, "").trim();

    // Post in forum (same logic as self-service jokers)
    try {
      const leagues = await getLeagues();
      const league = leagues.find((l) => l.dbId === leagueId);
      const category = league?.slug ?? "general";
      const content = `**${userName}** utilise un joker :\n\nSortie : **${outName}** (${outClub})\nEntree : **${inName}** (${inClub})\n\nEffectif a partir de la J${nextDay}.`;
      await postJokerToForum({ leagueId, leagueName: league?.name ?? "", category, userId, content });
    } catch {
      // Forum post failed — don't block the joker
    }

    return NextResponse.json({
      ok: true,
      message: `Joker utilisé : ${outName} → ${inName} (effectif à partir de la J${nextDay})`,
    });
  } catch (error) {
    console.error("Joker error:", error);
    return NextResponse.json({ error: "Erreur lors du joker" }, { status: 500 });
  }
}
