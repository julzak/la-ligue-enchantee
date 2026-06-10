export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

interface LeagueInput {
  name: string;
  divisionLabel: string;
  tier: number;
}

// GET ?seasonId= : ligues déjà créées pour la saison + pré-remplissage (template
// repris de la saison précédente). Le détail montées/descentes vient du chantier 4.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const seasonId = Number(searchParams.get("seasonId"));
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

  const leagues = await prisma.league.findMany({
    where: { seasonId },
    orderBy: [{ tier: "asc" }, { id: "asc" }],
    select: { id: true, name: true, divisionLabel: true, tier: true },
  });

  // Pré-remplissage : structure des divisions de la dernière saison CLÔTURÉE.
  // (Le mapping des participants montés/descendus arrive au chantier 4.)
  const prevSeason = await prisma.season.findFirst({
    where: { status: "CLOSED", id: { lt: seasonId } },
    orderBy: { id: "desc" },
  });

  let prefill: LeagueInput[] = [];
  if (prevSeason) {
    const prevLeagues = await prisma.league.findMany({
      where: { seasonId: prevSeason.id },
      orderBy: [{ tier: "asc" }, { id: "asc" }],
      select: { name: true, divisionLabel: true, tier: true },
    });
    prefill = prevLeagues
      .filter((l) => l.divisionLabel && l.tier != null)
      .map((l) => ({
        name: l.name,
        divisionLabel: l.divisionLabel as string,
        tier: l.tier as number,
      }));
  }

  return NextResponse.json({ leagues, prefill, prevSeasonLabel: prevSeason?.label ?? null });
}

// POST {seasonId, leagues:[{name, divisionLabel, tier}]} : crée les ligues.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { seasonId, leagues } = (await req.json()) as {
    seasonId?: number;
    leagues?: LeagueInput[];
  };

  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });
  if (!Array.isArray(leagues) || leagues.length === 0) {
    return NextResponse.json({ error: "Aucune ligue à créer" }, { status: 400 });
  }

  for (const l of leagues) {
    if (!l.name?.trim() || !l.divisionLabel?.trim() || typeof l.tier !== "number") {
      return NextResponse.json(
        { error: "Chaque ligue requiert nom, divisionLabel et tier" },
        { status: 400 }
      );
    }
  }

  const season = await prisma.season.findUnique({ where: { id: Number(seasonId) } });
  if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });
  if (season.status !== "SETUP") {
    return NextResponse.json(
      { error: "Ligues modifiables uniquement en statut SETUP" },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // Idempotent : re-sauver REMPLACE les ligues de la saison, y compris les
    // inscriptions de participants qui y étaient rattachées (à refaire à
    // l'étape 4 si on repasse par ici).
    const existing = await tx.league.findMany({
      where: { seasonId: Number(seasonId) },
      select: { id: true },
    });
    if (existing.length > 0) {
      await tx.leagueUser.deleteMany({
        where: { leagueId: { in: existing.map((l) => l.id) } },
      });
      await tx.league.deleteMany({ where: { seasonId: Number(seasonId) } });
    }
    for (const l of leagues) {
      await tx.league.create({
        data: {
          name: l.name.trim(),
          divisionLabel: l.divisionLabel.trim(),
          tier: l.tier,
          seasonId: Number(seasonId),
        },
      });
    }
  });

  const created = await prisma.league.findMany({
    where: { seasonId: Number(seasonId) },
    orderBy: [{ tier: "asc" }, { id: "asc" }],
    select: { id: true, name: true, divisionLabel: true, tier: true },
  });

  return NextResponse.json({ ok: true, leagues: created });
}
