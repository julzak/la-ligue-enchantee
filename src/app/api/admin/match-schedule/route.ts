import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = parseInt(searchParams.get("day") ?? "0");

  if (!day) return NextResponse.json({ matches: [] });

  const matches = await prisma.$queryRawUnsafe<{
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    infographic_url: string | null;
  }[]>(
    "SELECT home_team, away_team, home_score, away_score, infographic_url FROM MATCH_SCHEDULE WHERE matchday = ? ORDER BY match_date",
    day
  );

  return NextResponse.json({ matches });
}
