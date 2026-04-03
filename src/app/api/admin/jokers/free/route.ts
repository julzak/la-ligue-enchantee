import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  // Auth disabled — used by both admin (jokers) and participants (enchères)
  // const auth = await requireAdmin();
  // if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  const search = searchParams.get("search") ?? "";
  const clubId = Number(searchParams.get("clubId") ?? 0);

  // If clubId is set, return all free players from that club (no search needed)
  // Otherwise require a name search of at least 2 chars
  if (!leagueId || (!clubId && search.length < 2)) {
    return NextResponse.json({ players: [] });
  }

  const currentDay = (await prisma.score.findFirst({ orderBy: { day: "desc" } }))?.day ?? 1;

  // Get taken player IDs in this league
  const taken = await prisma.team.findMany({
    where: {
      leagueId,
      dayFirst: { lte: currentDay },
      dayLast: { gte: currentDay },
    },
    select: { playerId: true },
  });
  const takenIds = new Set(taken.map((t) => t.playerId));

  // Build query conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { clubId: { gt: 0 } };
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
