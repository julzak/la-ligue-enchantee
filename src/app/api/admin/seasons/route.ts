export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { canMutateSeason } from "@/lib/season-mutation-guard";
import type { SeasonStatus } from "@prisma/client";

const VALID_STATUS: SeasonStatus[] = ["SETUP", "AUCTION", "ACTIVE", "WINTER", "CLOSED"];

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const seasons = await prisma.season.findMany({
    orderBy: { id: "desc" },
    include: { _count: { select: { clubs: true, players: true, leagues: true } } },
  });
  return NextResponse.json({ seasons });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { label } = await req.json();
  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Label requis" }, { status: 400 });
  }
  const trimmed = label.trim();

  const existing = await prisma.season.findFirst({ where: { label: trimmed } });
  if (existing) {
    return NextResponse.json({ error: "Une saison avec ce label existe déjà" }, { status: 409 });
  }

  const season = await prisma.season.create({
    data: { label: trimmed, status: "SETUP" },
  });
  return NextResponse.json({ season });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id, status, isCurrent, label } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  // --- Renommage ---
  if (label !== undefined) {
    if (typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ error: "Label requis" }, { status: 400 });
    }
    const trimmed = label.trim();

    // Vérification côté serveur : seule une saison SETUP non-courante est renommable.
    const season = await prisma.season.findUnique({ where: { id: Number(id) } });
    if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });
    if (!canMutateSeason(season)) {
      return NextResponse.json(
        { error: "Seules les saisons en statut SETUP et non-courantes peuvent être renommées" },
        { status: 403 }
      );
    }

    // Rejet si label déjà pris par UNE AUTRE saison (comportement identique au POST).
    const conflict = await prisma.season.findFirst({
      where: { label: trimmed, id: { not: Number(id) } },
    });
    if (conflict) {
      return NextResponse.json({ error: "Une saison avec ce label existe déjà" }, { status: 409 });
    }

    const updated = await prisma.season.update({
      where: { id: Number(id) },
      data: { label: trimmed },
    });
    return NextResponse.json({ season: updated });
  }

  // --- Changement de statut / isCurrent (comportement original) ---
  const data: { status?: SeasonStatus; isCurrent?: boolean; startedAt?: Date } = {};
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    data.status = status;
    if (status === "ACTIVE") data.startedAt = new Date();
  }
  if (isCurrent !== undefined) data.isCurrent = Boolean(isCurrent);

  // Une seule saison courante à la fois : on transactionne le passage isCurrent.
  if (data.isCurrent === true) {
    const [, season] = await prisma.$transaction([
      prisma.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
      prisma.season.update({ where: { id: Number(id) }, data }),
    ]);
    return NextResponse.json({ season });
  }

  const season = await prisma.season.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ season });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const seasonId = Number(id);
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });

  // Garde serveur : refus net si la saison n'est pas SETUP ou si elle est courante.
  if (!canMutateSeason(season)) {
    return NextResponse.json(
      {
        error:
          "Seules les saisons en statut SETUP et non-courantes peuvent être supprimées. Une saison ACTIVE, WINTER ou CLOSED est inviolable.",
      },
      { status: 403 }
    );
  }

  // Cascade enfants-avant-parents scopée à la saison.
  //
  // IMPORTANT — MyISAM (CLUB, LEAGUE, PLAYER, LEAGUE_USER) ne supporte PAS les
  // transactions atomiques : $transaction regroupe les appels mais NE ROLLBACK PAS
  // en cas d'erreur partielle. L'opération est donc conçue pour être IDEMPOTENTE :
  // chaque étape supprime "ce qui reste pour cette saison", de sorte qu'un éventuel
  // échec partiel se rattrape en relançant la requête.
  //
  // Tables ciblées (toutes vérifiées dans prisma/schema.prisma ET dump prod ligueenc_v3.sql) :
  // 1. AUCTION_REMOVAL (dépend de AUCTION)
  // 2. AUCTION_BID     (dépend de AUCTION)
  // 3. AUCTION_BUDGET  (dépend de AUCTION)
  // 4. AUCTION         (dépend de LEAGUE)
  // 5. LEAGUE_USER     (dépend de LEAGUE — participants)
  // 6. LEAGUE          (dépend de SEASON)
  // 7. PLAYER          (dépend de SEASON)
  // 8. CLUB            (dépend de SEASON)
  // 9. SEASON          (racine)
  //
  // On ne touche JAMAIS PALMARES, SEASON_MOVEMENT, ni une autre saison.
  //
  // NB : LEAGUE_SCORE, LEAGUE_SCORE_DAY, LAST_SCORE n'existent PAS dans le schéma
  // ni dans les dumps prod — supprimées de la cascade (tables fantômes → HTTP 500).
  await prisma.$transaction(async (tx) => {
    // Récupère les IDs des ligues de cette saison (pour supprimer leurs enfants).
    const leagues = await tx.league.findMany({
      where: { seasonId },
      select: { id: true },
    });
    const leagueIds = leagues.map((l) => l.id);

    if (leagueIds.length > 0) {
      // Récupère les IDs des enchères de ces ligues.
      const auctions = await tx.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM AUCTION WHERE league_id IN (${leagueIds.join(",")})`
      );
      const auctionIds = auctions.map((a) => a.id);

      if (auctionIds.length > 0) {
        // 1. AUCTION_REMOVAL
        await tx.$executeRawUnsafe(
          `DELETE FROM AUCTION_REMOVAL WHERE auction_id IN (${auctionIds.join(",")})`
        );
        // 2. AUCTION_BID
        await tx.$executeRawUnsafe(
          `DELETE FROM AUCTION_BID WHERE auction_id IN (${auctionIds.join(",")})`
        );
        // 3. AUCTION_BUDGET
        await tx.$executeRawUnsafe(
          `DELETE FROM AUCTION_BUDGET WHERE auction_id IN (${auctionIds.join(",")})`
        );
      }

      // 4. AUCTION
      await tx.$executeRawUnsafe(
        `DELETE FROM AUCTION WHERE league_id IN (${leagueIds.join(",")})`
      );
      // 5. LEAGUE_USER
      await tx.$executeRawUnsafe(
        `DELETE FROM LEAGUE_USER WHERE ID_LEAGUE IN (${leagueIds.join(",")})`
      );
    }

    // 6. LEAGUE
    await tx.league.deleteMany({ where: { seasonId } });
    // 7. PLAYER
    await tx.player.deleteMany({ where: { seasonId } });
    // 8. CLUB
    await tx.club.deleteMany({ where: { seasonId } });
    // 9. SEASON (la saison elle-même)
    await tx.season.delete({ where: { id: seasonId } });
  });

  return NextResponse.json({ ok: true });
}
