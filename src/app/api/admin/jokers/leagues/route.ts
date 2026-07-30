export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getLeagues } from "@/lib/db";

export async function GET() {
  // Volontairement sans requireAdmin : consommé par le layout public
  // /ligue/[slug] (détection de l'enchère en cours) en plus des pages admin.
  // Lecture seule, liste des ligues = donnée non sensible.
  const leagues = await getLeagues();
  return NextResponse.json({ leagues });
}
