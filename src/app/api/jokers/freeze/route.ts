export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getJokersFreeze, formatFreezeDate } from "@/lib/jokers-freeze";

// État public du gel des jokers du mercato d'hiver, pour les bannières de
// l'accueil et des pages ligue. Pas d'auth : information publique, pas de
// donnée personnelle. Libellés formatés côté serveur pour que le client
// n'ait jamais à interpréter un DATETIME naïf.
export async function GET() {
  const freeze = await getJokersFreeze();
  return NextResponse.json({
    phase: freeze.phase,
    startLabel: freeze.start ? formatFreezeDate(freeze.start, false) : null,
    endLabel: freeze.end ? formatFreezeDate(freeze.end, true) : null,
  });
}
