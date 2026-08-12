import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMatchday } from "@/lib/db";
import { generateTopo, TopoError } from "@/lib/topo";
import { requireAuth } from "@/lib/admin-auth";

// GET: retrieve saved topo (if exists)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const currentDay = await getCurrentMatchday();

  const rows = await prisma.$queryRawUnsafe<{ content: string; is_provisional: number }[]>(
    "SELECT content, is_provisional FROM TOPO WHERE matchday = ? AND league_slug = ? LIMIT 1",
    currentDay,
    slug
  );

  if (rows.length > 0) {
    return NextResponse.json({
      topo: rows[0].content,
      matchday: currentDay,
      cached: true,
      isProvisional: rows[0].is_provisional === 1,
    });
  }

  return NextResponse.json({ topo: null, matchday: currentDay, cached: false, isProvisional: false });
}

// POST: generate + save topo (déclenchement manuel / regénération admin).
// La génération automatique à la publication passe par la même fonction
// generateTopo (voir api/admin/publish).
export async function POST(request: Request) {
  // Regénération manuelle réservée aux utilisateurs authentifiés : évite l'abus
  // anonyme (coût LLM) et le cache-poisoning via force:true depuis internet.
  // L'auto-génération à la publication passe par generateTopo() en direct, pas
  // par cette route, donc elle n'est pas impactée.
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const { slug, force } = await request.json();
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }
    const result = await generateTopo(slug, force === true);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TopoError) {
      if (error.status >= 500) console.error("Topo generation error:", error);
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Topo generation error:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du topo" }, { status: 500 });
  }
}
