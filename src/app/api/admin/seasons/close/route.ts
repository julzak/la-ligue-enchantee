export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { closeSeason } from "@/lib/season-close";

// POST {seasonId} : clôture la saison -> fige palmarès + mouvements (idempotent).
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { seasonId } = (await req.json()) as { seasonId?: number };
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

  try {
    const result = await closeSeason(Number(seasonId));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec clôture" },
      { status: 400 }
    );
  }
}
