export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/admin-auth";
import { getLeagues } from "@/lib/db";
import { getJokerEffectDay, applyJokerSwap } from "@/lib/joker-day";
import { postJokerToForum } from "@/lib/joker-forum";
import { getJokersFreeze, formatFreezeDate } from "@/lib/jokers-freeze";
import { getJokerQuotaForUser } from "@/lib/joker-quota";

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

  // Journée d'effet du joker = première journée dont le cutoff (18h la veille
  // du premier match, cf src/lib/joker-day-core.ts) n'est pas passé. L'effectif
  // affiché/modifiable est celui de cette journée.
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

  // Quota : un joker posé avant la deadline des jokers estivaux (août)
  // consomme ce pot ; passé la deadline, seuls les jokers estivaux NON
  // utilisés sont perdus (cf src/lib/joker-quota-core.ts).
  const quota = await getJokerQuotaForUser(leagueId, userId);

  // Gel des jokers pendant le mercato d'hiver : l'UI désactive le formulaire
  // (le POST re-vérifie de son côté, la fermeture ne repose pas sur le client).
  const freeze = await getJokersFreeze();

  return NextResponse.json({
    squad: squadData,
    jokersUsed: quota.used,
    jokersRemaining: quota.remaining,
    jokerHistory,
    currentDay,
    effectDay,
    effectCutoff: cutoff ? cutoff.toISOString() : null,
    freeze: {
      phase: freeze.phase,
      endLabel: freeze.end ? formatFreezeDate(freeze.end, true) : null,
    },
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

    // Gel des jokers pendant le mercato d'hiver : tolérance zéro, timestamp
    // serveur faisant foi (même convention que la deadline des enchères).
    // Le geste admin (/api/admin/jokers) reste possible pendant le gel.
    const freeze = await getJokersFreeze();
    if (freeze.phase === "active") {
      const endLabel = freeze.end ? formatFreezeDate(freeze.end, true) : "la fin du mercato d'hiver";
      return NextResponse.json(
        { error: `Jokers gelés pendant le mercato d'hiver : réouverture le ${endLabel}` },
        { status: 403 }
      );
    }

    // Verify user belongs to league
    const membership = await prisma.leagueUser.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership) return NextResponse.json({ error: "Pas membre de cette ligue" }, { status: 403 });

    // Journée d'effet : première journée dont le cutoff joker n'est pas passé
    // (18h la veille du premier match). Plus jamais « dernière publiée + 1 »,
    // qui laissait modifier une journée verrouillée tout le week-end.
    const { effectDay: nextDay } = await getJokerEffectDay();

    // Check joker limit (attribution par pot, cf src/lib/joker-quota-core.ts)
    const { used, remaining } = await getJokerQuotaForUser(leagueId, userId);

    if (remaining <= 0) {
      return NextResponse.json({ error: `Plus de jokers disponibles (${used} deja utilises, ${Math.max(0, remaining)} restant)` }, { status: 400 });
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

    await applyJokerSwap({
      leagueId, userId, playerOutId, playerInId,
      outDayFirst: outEntry.dayFirst, isSubs: outEntry.isSubs, effectDay: nextDay,
    });

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
    const league = leagues.find((l) => l.dbId === leagueId);
    const category = league?.slug ?? "general";

    // Auto-post dans le fil "Jokers <ligue> <saison courante>" (créé au besoin)
    let topicId: number | null = null;
    try {
      const content = `**${userName}** utilise un joker :\n\nSortie : **${outName}** (${outClub})\nEntree : **${inName}** (${inClub})\n\nEffectif a partir de la J${nextDay}.`;
      topicId = await postJokerToForum({ leagueId, leagueName: league?.name ?? "", category, userId, content });
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
