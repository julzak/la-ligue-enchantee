export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSquad } from "@/lib/football-api";

// Récupère l'effectif d'un club. Position éditable côté admin avant import.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const clubExternalId = searchParams.get("clubExternalId");
  if (!clubExternalId) {
    return NextResponse.json({ error: "clubExternalId requis" }, { status: 400 });
  }
  try {
    const { source, provider, data } = await getSquad(clubExternalId);
    return NextResponse.json({ source, provider, players: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec récupération effectif" },
      { status: 502 }
    );
  }
}
