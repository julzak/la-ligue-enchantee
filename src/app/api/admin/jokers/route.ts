import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

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

  const currentDay = (await prisma.score.findFirst({ orderBy: { day: "desc" } }))?.day ?? 1;

  // Get current squad
  const squad = await prisma.team.findMany({
    where: {
      leagueId, userId,
      dayFirst: { lte: currentDay },
      dayLast: { gte: currentDay },
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

  // Count jokers from JOKER_LOG
  const jokerLogs = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    "SELECT COUNT(*) as cnt FROM JOKER_LOG WHERE league_id = ? AND user_id = ?",
    leagueId, userId
  );
  const jokerUsed = Number(jokerLogs[0]?.cnt ?? 0);

  // Get joker config (max allowed)
  const configs = await prisma.$queryRawUnsafe<{ type: string; max_count: number; deadline: string | null; is_active: number }[]>(
    "SELECT type, max_count, deadline, is_active FROM JOKER_CONFIG WHERE season = '2025-2026' AND is_active = 1"
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
    currentDay,
  });
}

// POST: execute joker swap
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { leagueId, userId, playerOutId, playerInId } = await request.json() as {
      leagueId: number;
      userId: number;
      playerOutId: number;
      playerInId: number;
    };

    if (!leagueId || !userId || !playerOutId || !playerInId) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const currentDay = (await prisma.score.findFirst({ orderBy: { day: "desc" } }))?.day ?? 1;
    const nextDay = currentDay + 1;

    // Check joker limit from config
    const jokerCount = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      "SELECT COUNT(*) as cnt FROM JOKER_LOG WHERE league_id = ? AND user_id = ?",
      leagueId, userId
    );
    const used = Number(jokerCount[0]?.cnt ?? 0);

    const configs = await prisma.$queryRawUnsafe<{ max_count: number; deadline: string | null }[]>(
      "SELECT max_count, deadline FROM JOKER_CONFIG WHERE season = '2025-2026' AND is_active = 1"
    );
    const maxJokers = configs.reduce((sum, c) => {
      if (c.deadline && new Date(c.deadline) < new Date()) return sum;
      return sum + Number(c.max_count);
    }, 0);

    if (used >= maxJokers) {
      return NextResponse.json({ error: `Plus de jokers disponibles (${used}/${maxJokers} utilisés)` }, { status: 400 });
    }

    // Validate: playerOut is in this user's squad
    const outEntry = await prisma.team.findFirst({
      where: {
        leagueId, userId, playerId: playerOutId,
        dayFirst: { lte: currentDay },
        dayLast: { gte: currentDay },
      },
    });
    if (!outEntry) {
      return NextResponse.json({ error: "Ce joueur n'est pas dans l'effectif" }, { status: 400 });
    }

    // Validate: playerIn is free (not in any squad in this league)
    const taken = await prisma.team.findFirst({
      where: {
        leagueId,
        playerId: playerInId,
        dayFirst: { lte: currentDay },
        dayLast: { gte: currentDay },
      },
    });
    if (taken) {
      return NextResponse.json({ error: "Ce joueur est déjà pris par un autre participant" }, { status: 400 });
    }

    // Execute swap:
    // 1. End the outgoing player's stint (set dayLast to current day)
    await prisma.$executeRawUnsafe(
      "UPDATE TEAM SET DAY_LAST = ? WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY_FIRST = ?",
      currentDay, leagueId, userId, playerOutId, outEntry.dayFirst
    );

    // 2. Add the incoming player starting next day
    await prisma.$executeRawUnsafe(
      "INSERT INTO TEAM (ID_LEAGUE, ID_USER, ID_PLAYER, DAY_FIRST, DAY_LAST, IS_SUBS) VALUES (?, ?, ?, ?, 38, ?)",
      leagueId, userId, playerInId, nextDay, outEntry.isSubs
    );

    // 3. Log the joker
    await prisma.$executeRawUnsafe(
      "INSERT INTO JOKER_LOG (league_id, user_id, player_out_id, player_in_id, day) VALUES (?, ?, ?, ?, ?)",
      leagueId, userId, playerOutId, playerInId, currentDay
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
      message: `Joker utilisé : ${outName} → ${inName} (effectif à partir de la J${nextDay})`,
    });
  } catch (error) {
    console.error("Joker error:", error);
    return NextResponse.json({ error: "Erreur lors du joker" }, { status: 500 });
  }
}
