export const dynamic = "force-dynamic";

/**
 * POST /api/admin/seasons/reset
 *
 * Réinitialise une saison SETUP : vide toutes ses données de préparation
 * (clubs, joueurs, ligues, participants, enchères) MAIS conserve la coquille Season
 * (id + label + statut SETUP). Opération irréversible, transaction atomique.
 *
 * Garde serveur non-négociable : refuse si status != SETUP ou isCurrent = true.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { canMutateSeason } from "@/lib/season-mutation-guard";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const seasonId = Number(id);
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });

  // Garde serveur : refuse si pas SETUP ou si courante.
  if (!canMutateSeason(season)) {
    return NextResponse.json(
      {
        error:
          "Seules les saisons en statut SETUP et non-courantes peuvent être réinitialisées. Une saison ACTIVE, WINTER ou CLOSED est inviolable.",
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
  // La coquille Season est CONSERVÉE.
  //
  // NB : LEAGUE_SCORE, LEAGUE_SCORE_DAY, LAST_SCORE n'existent PAS dans le schéma
  // ni dans les dumps prod — supprimées de la cascade (tables fantômes → HTTP 500).
  await prisma.$transaction(async (tx) => {
    const leagues = await tx.league.findMany({
      where: { seasonId },
      select: { id: true },
    });
    const leagueIds = leagues.map((l) => l.id);

    if (leagueIds.length > 0) {
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
    // La coquille Season est conservée (pas de tx.season.delete).
  });

  return NextResponse.json({ ok: true, label: season.label });
}
