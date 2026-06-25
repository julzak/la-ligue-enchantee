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

  // Cascade FK-sûre dans une transaction :
  // L'ordre respecte les dépendances : les enfants avant les parents.
  //
  // 1. AUCTION_REMOVAL (dépend de AUCTION)
  // 2. AUCTION_BID     (dépend de AUCTION)
  // 3. AUCTION_BUDGET  (dépend de AUCTION)
  // 4. AUCTION         (dépend de LEAGUE)
  // 5. LEAGUE_USER     (dépend de LEAGUE — participants)
  // 6. LEAGUE_SCORE    (dépend de LEAGUE — scores agrégés)
  // 7. LEAGUE_SCORE_DAY (dépend de LEAGUE)
  // 8. LAST_SCORE      (dépend de LEAGUE)
  // 9. LEAGUE          (dépend de SEASON)
  // 10. PLAYER         (dépend de SEASON)
  // 11. CLUB           (dépend de SEASON)
  // 12. SEASON         (racine)
  //
  // Les ligues, clubs, joueurs sont scoppés à la saison via ID_SEASON.
  // On ne touche JAMAIS palmares, season_movement, ni une autre saison.
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
      // 6. LEAGUE_SCORE (scores agrégés par ligue — a priori vides en SETUP)
      await tx.$executeRawUnsafe(
        `DELETE FROM LEAGUE_SCORE WHERE ID_LEAGUE IN (${leagueIds.join(",")})`
      );
      // 7. LEAGUE_SCORE_DAY
      await tx.$executeRawUnsafe(
        `DELETE FROM LEAGUE_SCORE_DAY WHERE ID_LEAGUE IN (${leagueIds.join(",")})`
      );
      // 8. LAST_SCORE
      await tx.$executeRawUnsafe(
        `DELETE FROM LAST_SCORE WHERE ID_LEAGUE IN (${leagueIds.join(",")})`
      );
    }

    // 9. LEAGUE
    await tx.league.deleteMany({ where: { seasonId } });
    // 10. PLAYER
    await tx.player.deleteMany({ where: { seasonId } });
    // 11. CLUB
    await tx.club.deleteMany({ where: { seasonId } });
    // 12. SEASON (la saison elle-même)
    await tx.season.delete({ where: { id: seasonId } });
  });

  return NextResponse.json({ ok: true });
}
