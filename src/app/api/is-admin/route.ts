export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isUserAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getLeagues } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ isAdmin: false });
  }
  const userId = (session.user as { userId?: number }).userId;
  if (!userId) {
    return NextResponse.json({ isAdmin: false });
  }
  const admin = await isUserAdmin(userId);

  // Find user's league slug for "Mon équipe" link
  const leagueRows = await prisma.$queryRawUnsafe<{ ID_LEAGUE: number }[]>(
    "SELECT ID_LEAGUE FROM LEAGUE_USER WHERE ID_USER = ? LIMIT 1",
    userId
  );
  let myLeagueSlug: string | null = null;
  if (leagueRows.length > 0) {
    const leagues = await getLeagues();
    const found = leagues.find((l) => l.dbId === Number(leagueRows[0].ID_LEAGUE));
    if (found) myLeagueSlug = found.slug;
  }

  return NextResponse.json({ isAdmin: admin, myLeagueSlug });
}
