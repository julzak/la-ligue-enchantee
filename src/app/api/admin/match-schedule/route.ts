import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getCurrentSeasonKey } from "@/lib/season";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const day = parseInt(searchParams.get("day") ?? "0");

  if (!day) return NextResponse.json({ matches: [] });

  const rows = await prisma.$queryRawUnsafe<{
    id: bigint;
    home_team: string;
    away_team: string;
    match_date: Date;
    match_time: Date | null;
    home_score: number | null;
    away_score: number | null;
    is_postponed: number | null;
    admin_override_date: Date | null;
    infographic_url: string | null;
  }[]>(
    "SELECT id, home_team, away_team, match_date, match_time, home_score, away_score, is_postponed, admin_override_date, infographic_url FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ? ORDER BY COALESCE(admin_override_date, match_date), match_time",
    await getCurrentSeasonKey(), day
  );

  // MATCH_SCHEDULE.id est BIGINT cote MySQL : Prisma raw renvoie BigInt,
  // que NextResponse.json ne sait pas serialiser. Cast en Number (les ids
  // restent largement sous 2^53).
  const matches = rows.map((r) => ({ ...r, id: Number(r.id) }));

  return NextResponse.json({ matches });
}

// PATCH: update postponed status / new date for a match in retard
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const body = (await request.json()) as {
      id: number;
      is_postponed?: 0 | 1;
      admin_override_date?: string | null; // YYYY-MM-DD or null to clear
    };

    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.is_postponed !== undefined) {
      sets.push("is_postponed = ?");
      values.push(body.is_postponed);
    }
    if (body.admin_override_date !== undefined) {
      sets.push("admin_override_date = ?");
      values.push(body.admin_override_date); // null clears, "YYYY-MM-DD" sets
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    values.push(body.id);

    await prisma.$executeRawUnsafe(
      `UPDATE MATCH_SCHEDULE SET ${sets.join(", ")} WHERE id = ?`,
      ...values
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError500("[match-schedule]", e, "Échec de la mise à jour du match");
  }
}
