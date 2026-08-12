import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLUB_GK_KEY_PREFIX } from "@/lib/club-goalkeeper";
import { getSeasonFilters } from "@/lib/season";
import { getCurrentMatchday } from "@/lib/db";

export async function GET(request: Request) {
  // Volontairement sans requireAdmin (commit 477ae33) : consommé par les pages
  // participant /ligue/[slug]/encheres et /ligue/[slug]/jokers en plus des pages
  // admin. Lecture seule, joueurs libres = donnée non sensible.
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  const search = searchParams.get("search") ?? "";
  const clubId = Number(searchParams.get("clubId") ?? 0);

  // If clubId is set, return all free players from that club (no search needed)
  // Otherwise require a name search of at least 2 chars
  if (!leagueId || (!clubId && search.length < 2)) {
    return NextResponse.json({ players: [] });
  }

  // Journée courante scopée saison (0 en avant-saison), pas le max global SCORE.
  // Joueurs pris = effectif actif à la prochaine journée composable (rosterDay) :
  // en avant-saison rosterDay=1, l'effectif issu des enchères (dayFirst=1) est bien
  // exclu. NB : pendant la phase d'enchères, TEAM est vide (les pris viennent
  // d'AUCTION_BID plus bas), donc ce scope est neutre pour le module enchères.
  const currentDay = await getCurrentMatchday();
  const rosterDay = currentDay + 1;

  // Get taken player IDs in this league (effectif constitué)
  const taken = await prisma.team.findMany({
    where: {
      leagueId,
      dayFirst: { lte: rosterDay },
      dayLast: { gte: rosterDay },
    },
    select: { playerId: true },
  });
  const takenIds = new Set(taken.map((t) => t.playerId));

  // Exclude players already WON in the active summer auction for this league.
  // During the auction phase, won players are in AUCTION_BID (status='won') but
  // not yet in TEAM. They must not appear in search results (règle 3.1 + BRIEF-04).
  const activeAuction = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM AUCTION WHERE league_id = ? AND status != 'resolved' AND COALESCE(type,'summer') = 'summer' ORDER BY id DESC LIMIT 1",
    leagueId
  );
  if (activeAuction.length > 0) {
    const wonBids = await prisma.$queryRawUnsafe<{ player_id: number }[]>(
      "SELECT player_id FROM AUCTION_BID WHERE auction_id = ? AND status = 'won'",
      Number(activeAuction[0].id)
    );
    wonBids.forEach((b) => takenIds.add(Number(b.player_id)));
  }

  // Périmètre saison courant — DOIT être identique à la garde B1 de POST /api/auction
  // pour éviter toute incohérence recherche/soumission (bug smoke HIGH 2026-06-11).
  // Mode legacy (saison sans scope joueurs) : seasonFilters.player = {} → pas de
  // filtre ID_SEASON, tous les joueurs sont proposables, la garde accepte également tout.
  const seasonFilters = await getSeasonFilters();
  const seasonPlayerFilter = seasonFilters.player; // {} ou { seasonId: N }

  // Build query conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { clubId: { gt: 0 }, ...seasonPlayerFilter };
  // Gardiens : seuls les pseudo-joueurs « Gardiens [Club] » (clé stable
  // `gardiens_*` dans LINK) sont proposables à la mise ; aucun gardien nommé
  // (règle 2.1 + décision 2026-06-10, docs/regles-encheres.md §7). Les
  // gardiens nommés restent visibles dans l'explorateur, hors flux de mise.
  // « ardien » couvre Gardien/gardien quelle que soit la collation.
  where.AND = [
    {
      OR: [
        { NOT: { position: { contains: "ardien" } } },
        { link: { startsWith: CLUB_GK_KEY_PREFIX } },
      ],
    },
  ];
  if (clubId) {
    where.clubId = clubId;
  }
  if (search.length >= 2) {
    where.OR = [
      { lname: { contains: search } },
      { fname: { contains: search } },
    ];
  }

  // Search players
  const players = await prisma.player.findMany({
    where,
    take: 50,
    orderBy: { lname: "asc" },
  });

  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));

  const free = players
    .filter((p) => !takenIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: `${p.fname} ${p.lname}`.trim(),
      position: p.position,
      clubName: clubMap.get(p.clubId) ?? "",
    }));

  // Also return the clubs list for the filter dropdown (only clubs with players)
  const clubList = Array.from(clubMap.entries())
    .map(([id, name]) => ({ id, name }))
    .filter((c) => c.id > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ players: free, clubs: clubList });
}
