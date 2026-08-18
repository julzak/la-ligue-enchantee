export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSeasonKey } from "@/lib/season";
import { requireAuth } from "@/lib/admin-auth";
import { getLeagues, getCurrentMatchday } from "@/lib/db";
import { postJokerToForum } from "@/lib/joker-forum";

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

  // Journée courante scopée saison (0 en avant-saison), et NON le max global de
  // SCORE toutes saisons confondues (bug historique : findFirst renvoyait ~38).
  // L'effectif à afficher/modifier est celui de la PROCHAINE journée composable
  // (rosterDay), là où le joker agira : avant-saison -> effectif J1 ; en saison
  // -> effectif de la journée à venir (dont un joker déjà posé pour cette journée).
  const currentDay = await getCurrentMatchday();
  const rosterDay = currentDay + 1;

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
    "SELECT type, max_count, deadline FROM JOKER_CONFIG WHERE season = ? AND is_active = 1",
    await getCurrentSeasonKey()
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

    // Journée courante scopée saison (0 en avant-saison), pas le max global de
    // SCORE toutes saisons confondues. Le joker prend effet à nextDay = la
    // prochaine journée composable (J1 en avant-saison).
    const currentDay = await getCurrentMatchday();
    const nextDay = currentDay + 1;

    // Check joker limit
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
      return NextResponse.json({ error: `Plus de jokers disponibles (${used}/${maxJokers} utilises)` }, { status: 400 });
    }

    // Validate: playerOut is in user's squad — au jour où le joker agit (nextDay).
    // En avant-saison (currentDay=0), l'effectif est valide dès nextDay=1 : baser
    // la vérif sur currentDay=0 rejetterait tout (dayFirst=1 > 0).
    const outEntry = await prisma.team.findFirst({
      where: {
        leagueId, userId, playerId: playerOutId,
        dayFirst: { lte: nextDay },
        dayLast: { gte: nextDay },
      },
    });
    if (!outEntry) {
      return NextResponse.json({ error: "Ce joueur n'est pas dans votre effectif" }, { status: 400 });
    }

    // Validate: playerIn is free — au jour où le joker agit (nextDay). Sinon, en
    // avant-saison, un joueur déjà pris (dayFirst=1) serait vu comme libre.
    const taken = await prisma.team.findFirst({
      where: {
        leagueId,
        playerId: playerInId,
        dayFirst: { lte: nextDay },
        dayLast: { gte: nextDay },
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

    // JOKER_LOG.day = currentDay (jour de decision du joker = DAY_LAST du sortant),
    // meme convention que la pose admin. L'annulation admin suppose
    // DAY_LAST = jokerDay et DAY_FIRST = jokerDay + 1 : loguer nextDay ici
    // rendait l'undo d'un joker self-service inoperant (0 ligne TEAM touchee)
    // tout en supprimant le log -> effectif corrompu silencieusement.
    await prisma.$executeRawUnsafe(
      "INSERT INTO JOKER_LOG (league_id, user_id, player_out_id, player_in_id, day) VALUES (?, ?, ?, ?, ?)",
      leagueId, userId, playerOutId, playerInId, currentDay
    );

    // Copy lineup from current day to next day, replacing OUT with IN player
    const prevLineup = await prisma.teamDay.findMany({
      where: { leagueId, userId, day: currentDay },
    });
    if (prevLineup.length > 0) {
      // Delete any existing lineup for nextDay
      await prisma.teamDay.deleteMany({
        where: { leagueId, userId, day: nextDay },
      });
      const now = new Date();
      await prisma.teamDay.createMany({
        data: prevLineup.map((l) => ({
          leagueId,
          userId,
          playerId: l.playerId === playerOutId ? playerInId : l.playerId,
          day: nextDay,
          indx: l.indx,
          isValid: l.isValid,
          dtSave: now,
          dtValid: now,
        })),
      });
    }

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

    // Get league slug for forum category (derive from league name, not id —
    // real DB ids are 19/20/22, not 1/2/3)
    const leagues = await getLeagues();
    const category = leagues.find((l) => l.dbId === leagueId)?.slug ?? "general";

    // Auto-post dans le fil "Jokers <saison courante>" de la ligue (créé au besoin)
    let topicId: number | null = null;
    try {
      const content = `**${userName}** utilise un joker :\n\nSortie : **${outName}** (${outClub})\nEntree : **${inName}** (${inClub})\n\nEffectif a partir de la J${nextDay}.`;
      topicId = await postJokerToForum({ leagueId, category, userId, content });
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
