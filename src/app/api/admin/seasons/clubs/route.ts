export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getClubs } from "@/lib/football-api";

// Récupère la liste des clubs de Ligue 1 depuis l'API football (live ou mock).
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const { source, provider, data } = await getClubs();
    return NextResponse.json({ source, provider, clubs: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec récupération clubs" },
      { status: 502 }
    );
  }
}
