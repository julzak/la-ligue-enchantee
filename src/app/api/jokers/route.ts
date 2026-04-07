export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/admin-auth";

// GET: get squad + joker info for the logged-in user
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.session.user.userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  if (!leagueId) return NextResponse.json({ error: "leagueId requis" }, { status: 400 });

  // Verify user belongs to league
  const membership = await prisma.leagueUser.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership) return NextResponse.json({ error: "Pas membre de cette ligue" }, { status: 403 });

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
      name: p ? `${p.fname} ${p.lname}`.trim() : `Joueur ${s.playerId}`,
      position: p?.position ?? "",
      clubName: p ? (clubMap.get(p.clubId) ?? "") : "",
      isSubs: s.isSubs === 1,
      dayFirst: s.dayFirst,
    };
  });

  // Joker history
  const jokerLogEntries = await prisma.$queryRawUnsafe<{
    id: number; player_out_id: number; player_in_id: number; day: number;
  }[]>(
    "SELECT id, player_out_id, player_in_id, day FROM JOKER_LOG WHERE league_id = ? AND user_id = ? ORDER BY id DESC",
    leagueId, userId
  );
  const jokerUsed = jokerLogEntries.length;

  // Resolve player names for history
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
    playerOutName: jokerPlayerMap.get(Number(j.player_out_id)) ?? `#${j.player_out_id}`,
    playerInName: jokerPlayerMap.get(Number(j.player_in_id)) ?? `#${j.player_in_id}`,
    day: Number(j.day),
  }));

  // Joker config
  const configs = await prisma.$queryRawUnsafe<{ type: string; max_count: number; deadline: string | null }[]>(
    "SELECT type, max_count, deadline FROM JOKER_CONFIG WHERE season = '2025-2026' AND is_active = 1"
  );
  const totalMax = configs.reduce((sum, c) => {
    if (c.deadline && new Date(c.deadline) < new Date()) return sum;
    return sum + Number(c.max_count);
  }, 0);

  return NextResponse.json({
    squad: squadData,
    jokersUsed: jokerUsed,
    jokersRemaining: totalMax - jokerUsed,
    jokerHistory,
    currentDay,
  });
}

// POST: execute joker swap + auto-post forum topic
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.session.user.userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  try {
    const { leagueId, playerOutId, playerInId } = await request.json() as {
      leagueId: number;
      playerOutId: number;
      playerInId: number;
    };

    if (!leagueId || !playerOutId || !playerInId) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }

    // Verify user belongs to league
    const membership = await prisma.leagueUser.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership) return NextResponse.json({ error: "Pas membre de cette ligue" }, { status: 403 });

    const currentDay = (await prisma.score.findFirst({ orderBy: { day: "desc" } }))?.day ?? 1;
    const nextDay = currentDay + 1;

    // Check joker limit
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
      return NextResponse.json({ error: `Plus de jokers disponibles (${used}/${maxJokers} utilises)` }, { status: 400 });
    }

    // Validate: playerOut is in user's squad
    const outEntry = await prisma.team.findFirst({
      where: {
        leagueId, userId, playerId: playerOutId,
        dayFirst: { lte: currentDay },
        dayLast: { gte: currentDay },
      },
    });
    if (!outEntry) {
      return NextResponse.json({ error: "Ce joueur n'est pas dans votre effectif" }, { status: 400 });
    }

    // Validate: playerIn is free
    const taken = await prisma.team.findFirst({
      where: {
        leagueId,
        playerId: playerInId,
        dayFirst: { lte: currentDay },
        dayLast: { gte: currentDay },
      },
    });
    if (taken) {
      return NextResponse.json({ error: "Ce joueur est deja pris par un autre participant" }, { status: 400 });
    }

    // Execute swap
    await prisma.$executeRawUnsafe(
      "UPDATE TEAM SET DAY_LAST = ? WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY_FIRST = ?",
      currentDay, leagueId, userId, playerOutId, outEntry.dayFirst
    );

    await prisma.$executeRawUnsafe(
      "INSERT INTO TEAM (ID_LEAGUE, ID_USER, ID_PLAYER, DAY_FIRST, DAY_LAST, IS_SUBS) VALUES (?, ?, ?, ?, 38, ?)",
      leagueId, userId, playerInId, nextDay, outEntry.isSubs
    );

    await prisma.$executeRawUnsafe(
      "INSERT INTO JOKER_LOG (league_id, user_id, player_out_id, player_in_id, day) VALUES (?, ?, ?, ?, ?)",
      leagueId, userId, playerOutId, playerInId, currentDay
    );

    // Get player + user names for forum post
    const [playerOut, playerIn, userRows] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerOutId } }),
      prisma.player.findUnique({ where: { id: playerInId } }),
      prisma.$queryRawUnsafe<{ NAME: string }[]>(
        "SELECT NAME FROM USER WHERE ID_USER = ?", userId
      ),
    ]);

    const outName = playerOut ? `${playerOut.fname} ${playerOut.lname}`.trim() : `#${playerOutId}`;
    const inName = playerIn ? `${playerIn.fname} ${playerIn.lname}`.trim() : `#${playerInId}`;
    const outClub = playerOut ? (await prisma.club.findUnique({ where: { id: playerOut.clubId } }))?.name ?? "" : "";
    const inClub = playerIn ? (await prisma.club.findUnique({ where: { id: playerIn.clubId } }))?.name ?? "" : "";
    const userName = (userRows[0]?.NAME ?? "").replace(/<[^>]*>/g, "").trim();

    // Get league slug for forum category
    const leagueSlugMap: Record<number, string> = { 1: "ligue-1", 2: "ligue-2", 3: "national-1" };
    const category = leagueSlugMap[leagueId] ?? "general";

    // Auto-post forum topic
    let topicId: number | null = null;
    try {
      const title = `Joker : ${outName} -> ${inName}`;
      const content = `**${userName}** utilise un joker :\n\nSortie : **${outName}** (${outClub})\nEntree : **${inName}** (${inClub})\n\nEffectif a partir de la J${nextDay}.`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO FORUM_TOPIC (league_id, category, author_id, title, post_count, last_post_at, last_post_by, created_at)
         VALUES (?, ?, ?, ?, 1, NOW(), ?, NOW())`,
        leagueId, category, userId, title, userId
      );

      const [row] = await prisma.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() as id");
      topicId = Number(row.id);

      await prisma.$executeRawUnsafe(
        "INSERT INTO FORUM_POST (topic_id, author_id, content, created_at) VALUES (?, ?, ?, NOW())",
        topicId, userId, content
      );
    } catch {
      // Forum post failed — don't block the joker
    }

    return NextResponse.json({
      ok: true,
      message: `Joker utilise : ${outName} sort, ${inName} entre (effectif J${nextDay})`,
      topicId,
    });
  } catch (error) {
    console.error("Joker error:", error);
    return NextResponse.json({ error: "Erreur lors du joker" }, { status: 500 });
  }
}
