export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { POSITIONS, type ApiPosition } from "@/lib/football-api";

interface ImportPlayer {
  fname: string;
  lname: string;
  position: ApiPosition;
}
interface ImportClub {
  externalId?: string;
  name: string;
  players: ImportPlayer[];
}

// Importe en base les clubs validés + leurs effectifs, rattachés à la saison.
// La position envoyée fait foi (déjà corrigée par l'admin côté UI).
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { seasonId, clubs } = (await req.json()) as {
    seasonId?: number;
    clubs?: ImportClub[];
  };

  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });
  if (!Array.isArray(clubs) || clubs.length === 0) {
    return NextResponse.json({ error: "Aucun club à importer" }, { status: 400 });
  }

  const season = await prisma.season.findUnique({ where: { id: Number(seasonId) } });
  if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });
  if (season.status !== "SETUP") {
    return NextResponse.json(
      { error: "Import autorisé uniquement en statut SETUP" },
      { status: 409 }
    );
  }

  // Validation des positions avant transaction.
  for (const club of clubs) {
    if (!club.name?.trim()) {
      return NextResponse.json({ error: "Club sans nom" }, { status: 400 });
    }
    for (const p of club.players || []) {
      if (!POSITIONS.includes(p.position)) {
        return NextResponse.json(
          { error: `Position invalide "${p.position}" (${club.name})` },
          { status: 400 }
        );
      }
    }
  }

  let clubCount = 0;
  let playerCount = 0;

  await prisma.$transaction(async (tx) => {
    // Idempotent : re-importer REMPLACE l'import précédent de la saison
    // (sans danger : l'import n'est autorisé qu'en SETUP, avant que TEAM/SCORE
    // ne référencent ces joueurs).
    await tx.player.deleteMany({ where: { seasonId: Number(seasonId) } });
    await tx.club.deleteMany({ where: { seasonId: Number(seasonId) } });

    for (const club of clubs) {
      const created = await tx.club.create({
        data: {
          name: club.name.trim(),
          idClubEq: (club.externalId || "").slice(0, 10),
          seasonId: Number(seasonId),
        },
      });
      clubCount++;

      const players = (club.players || []).filter((p) => p.fname?.trim() || p.lname?.trim());
      if (players.length > 0) {
        await tx.player.createMany({
          data: players.map((p) => ({
            fname: p.fname.trim(),
            lname: p.lname.trim(),
            position: p.position,
            clubId: created.id,
            seasonId: Number(seasonId),
          })),
        });
        playerCount += players.length;
      }
    }
  });

  return NextResponse.json({ ok: true, clubCount, playerCount });
}
