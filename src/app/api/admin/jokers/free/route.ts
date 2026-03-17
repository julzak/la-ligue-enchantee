import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  const search = searchParams.get("search") ?? "";

  if (!leagueId || search.length < 2) {
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

  // Search players by name
  const players = await prisma.player.findMany({
    where: {
      clubId: { gt: 0 },
      OR: [
        { lname: { contains: search } },
        { fname: { contains: search } },
      ],
    },
    take: 20,
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

  return NextResponse.json({ players: free });
}
