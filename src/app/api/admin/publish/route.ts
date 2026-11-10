import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { leagueSlug } from "@/lib/season-key";
import { generateTopo } from "@/lib/topo";
import { recomputeStatsForDay } from "@/lib/publish-stats";

// POST: publish a matchday (recalculate STATS_USER for all leagues)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { day } = await request.json() as { day: number };
    if (!day) return NextResponse.json({ error: "day required" }, { status: 400 });

    const leagues = await recomputeStatsForDay(day);

    // Génération automatique des synthèses Lia (remplace le déclenchement manuel).
    // En tâche de fond et ESPACÉ : le free tier de Gemini 2.5 Pro plafonne à ~2
    // requêtes/minute. On génère les ligues séquentiellement avec un délai pour
    // qu'elles passent (presque) toutes sur Pro plutôt que de retomber sur Flash.
    // Ne bloque JAMAIS la réponse de publication ; un échec est loggé, pas propagé.
    const slugsToGenerate = leagues.map((l) => leagueSlug(l.name));
    void (async () => {
      for (let i = 0; i < slugsToGenerate.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 35_000)); // respect du quota Pro
        try {
          await generateTopo(slugsToGenerate[i], true);
          console.log(`[publish] synthèse Lia générée: ${slugsToGenerate[i]} (J${day})`);
        } catch (e) {
          console.error(`[publish] synthèse Lia échouée (${slugsToGenerate[i]}):`, (e as Error).message);
        }
      }
    })();

    return NextResponse.json({ ok: true, day, message: `Journée ${day} publiée pour ${leagues.length} ligues` });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json({ error: "Erreur publication" }, { status: 500 });
  }
}
