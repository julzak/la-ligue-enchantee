export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getSquad } from "@/lib/football-api";
import { normalizePlayerName, getSdbPremiumKey, syncSeasonPhotos } from "@/lib/photo-sync";

// POST {seasonId, clubId} : rafraîchissement INCRÉMENTAL de l'effectif d'un
// club (recrues du mercato, phase 8 du kick-off). Ajoute uniquement les
// joueurs absents de notre base : jamais de suppression ni de modification
// des joueurs existants et des équipes constituées. Autorisé saison lancée.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { seasonId, clubId } = (await req.json()) as { seasonId?: number; clubId?: number };
  if (!seasonId || !clubId) return NextResponse.json({ error: "seasonId et clubId requis" }, { status: 400 });

  const club = await prisma.club.findUnique({ where: { id: Number(clubId) } });
  if (!club || club.seasonId !== Number(seasonId)) {
    return NextResponse.json({ error: "Club introuvable pour cette saison" }, { status: 404 });
  }

  const squad = await getSquad(club.idClubEq);
  if (squad.source !== "live") {
    return NextResponse.json(
      { error: "Source effectifs indisponible : renseigner le token football-data.org (Admin → Configuration)" },
      { status: 409 }
    );
  }

  const existing = await prisma.player.findMany({
    where: { clubId: club.id, seasonId: Number(seasonId) },
    select: { fname: true, lname: true },
  });
  const known = new Set(existing.map((p) => normalizePlayerName(`${p.fname} ${p.lname}`)));

  const added: { name: string; position: string }[] = [];
  const addedIds: number[] = [];
  for (const p of squad.data) {
    const name = `${p.fname} ${p.lname}`.trim();
    if (known.has(normalizePlayerName(name))) continue;
    const created = await prisma.player.create({
      data: {
        fname: p.fname,
        lname: p.lname,
        position: p.position,
        clubId: club.id,
        seasonId: Number(seasonId),
      },
    });
    added.push({ name, position: p.position });
    addedIds.push(created.id);
  }

  // Photos des nouveaux uniquement : seulement si la clé premium est encore
  // active (fenêtre d'abonnement d'août). Hors fenêtre : avatar initiales.
  let photosNote = "clé photos absente, avatars à initiales";
  if (addedIds.length > 0 && (await getSdbPremiumKey())) {
    try {
      const report = await syncSeasonPhotos(Number(seasonId), false, addedIds);
      photosNote = `${report.downloaded} photos téléchargées`;
    } catch (e) {
      photosNote = `photos non récupérées (${e instanceof Error ? e.message : "?"})`;
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      added.length === 0
        ? `Aucun nouveau joueur chez ${club.name} (effectif déjà à jour).`
        : `${added.length} nouveau(x) joueur(s) ajouté(s) chez ${club.name} (${photosNote}).`,
    added,
  });
}
