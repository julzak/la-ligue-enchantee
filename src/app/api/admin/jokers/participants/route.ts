import { NextResponse } from "next/server";
import { getLeagueParticipants } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  if (!leagueId) return NextResponse.json({ participants: [] });

  const participants = await getLeagueParticipants(leagueId);
  return NextResponse.json({
    participants: participants.map((p) => ({ id: p.id, cleanName: p.cleanName })),
  });
}
