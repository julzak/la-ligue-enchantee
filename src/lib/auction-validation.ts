/**
 * Validation partagée de la composition d'une soumission d'enchère d'ÉTÉ.
 *
 * Ce module factorise EXACTEMENT les gardes serveur qui étaient inline dans
 * `src/app/api/auction/route.ts` (POST participant). Il est désormais importé par :
 *   - src/app/api/auction/route.ts             (soumission participant, garde deadline EN PLUS)
 *   - src/app/api/admin/auction/route.ts       (action `enter-bid-for-user`, SANS garde deadline)
 *   - src/lib/auction-validation.test.ts        (tests unitaires, DB mockée)
 *
 * Contrat (BRIEF-04, repris à l'identique) :
 *   - amounts  : toutes les mises doivent être > 0
 *   - B3       : pas de doublon de playerId dans la soumission
 *   - B0       : aucun joueur déjà attribué (status='won') à un AUTRE participant
 *   - B0b      : aucun joueur déjà acquis par le participant lui-même (règle 3.1)
 *   - B1       : chaque joueur existe dans le périmètre de la saison ET n'est pas
 *                un gardien nommé (les pseudo-gardiens « Gardiens [Club] » sont OK)
 *   - B2-GK    : au plus 1 gardien dans la mise (acquis compris)
 *   - HARD     : garde-fou ferme (décision 2026-08-10) : 13 joueurs max
 *                (acquis + mise), budget restant max, maxima de ligne
 *                DEF/MIL/ATT (logique pure : src/lib/auction-hard-limits.ts)
 *
 * La garde deadline (tolérance 0) N'EST PAS ici : c'est une garde de TEMPS,
 * pas de composition. Elle reste propre à chaque route :
 *   - participant : rejette si l'heure butoir est dépassée ;
 *   - admin       : ne l'applique PAS (le but de la saisie manuelle est de
 *                   rattraper un retardataire après le butoir).
 *
 * Le moteur (src/lib/auction-engine.ts) n'est PAS modifié : ce module ne fait
 * qu'orchestrer les fonctions pures existantes + les requêtes de lecture DB,
 * exactement comme le faisait le POST participant.
 */

import { inParams } from "@/lib/prisma";
import { getSeasonFilters } from "@/lib/season";
import { isNamedGoalkeeper } from "@/lib/club-goalkeeper";
import { findAlreadyWonByOther, findAlreadyWonBySelf } from "@/lib/auction-already-won";
import { checkGoalkeeperLimit } from "@/lib/auction-goalkeeper-limit";
import { findDuplicatePlayerIds } from "@/lib/auction-duplicate-bids";
import { findHardLimitErrors } from "@/lib/auction-hard-limits";
import { lineFromPosition } from "@/lib/auction-resolution";

export interface SummerBid {
  playerId: number;
  amount: number;
}

/** Erreur de validation : message identique à la réponse HTTP de la route. */
export interface ValidationError {
  error: string;
  status: number;
}

/**
 * Sous-ensemble de l'API Prisma réellement utilisé ici. Permet aux tests de
 * mocker la DB sans tirer tout le client (aucun accès DB en test).
 * Signature volontairement minimale : seul `$queryRawUnsafe` est lu.
 */
export interface PrismaLike {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * Rejoue les gardes de composition d'une soumission d'été (B0/B0b/B1/B2-GK/B3
 * + amounts). Lit la DB pour les won bids, le périmètre saison et les positions.
 *
 * @returns `null` si la soumission est valide, sinon `{ error, status }`
 *          (même message et même code que la route participant).
 *
 * Ce contrôle est volontairement IDENTIQUE pour le participant et pour l'admin :
 * une saisie admin invalide est rejetée avec la même erreur qu'une soumission
 * participant invalide. Seule la garde deadline (hors de ce module) diffère.
 */
export async function validateSummerBids(
  db: PrismaLike,
  auctionId: number,
  userId: number,
  bids: SummerBid[]
): Promise<ValidationError | null> {
  // amounts > 0
  if (bids.some((b) => b.amount <= 0)) {
    return { error: "Les mises doivent etre > 0", status: 400 };
  }

  // B3 : pas de doublon de playerId dans la soumission
  const duplicateIds = findDuplicatePlayerIds(bids);
  if (duplicateIds.length > 0) {
    return {
      error: `Le joueur #${duplicateIds[0]} apparait plusieurs fois dans la soumission : une seule mise par joueur est autorisee.`,
      status: 400,
    };
  }

  if (bids.length === 0) return null;

  // B0 / B0b : joueurs déjà attribués (à un autre, ou à soi-même)
  const [bidPh, bidVs] = inParams(bids.map((b) => b.playerId));
  const alreadyWon = await db.$queryRawUnsafe<{ player_id: number; user_id: number }[]>(
    `SELECT player_id, user_id FROM AUCTION_BID
     WHERE auction_id = ? AND status = 'won' AND player_id IN (${bidPh})`,
    auctionId, ...bidVs
  );
  const conflicts = findAlreadyWonByOther(bids, userId, alreadyWon);
  if (conflicts.length > 0) {
    return {
      error: `Le joueur #${conflicts[0]} a déjà été attribué à un autre participant.`,
      status: 400,
    };
  }
  const selfConflicts = findAlreadyWonBySelf(bids, userId, alreadyWon);
  if (selfConflicts.length > 0) {
    return {
      error: `Vous avez déjà acquis ce joueur, il est reporté automatiquement (règle 3.1 — aucune nouvelle mise nécessaire).`,
      status: 400,
    };
  }

  // B1 : existence dans le périmètre saison + interdiction des gardiens nommés
  const [ph, vs] = inParams(bids.map((b) => b.playerId));
  const seasonFilters = await getSeasonFilters();
  const foundPlayers = await db.$queryRawUnsafe<{
    id: number; position: string; link: string | null;
  }[]>(
    `SELECT p.ID_PLAYER as id, p.POSITION as position, p.LINK as link
     FROM PLAYER p
     WHERE p.ID_PLAYER IN (${ph})`,
    ...vs
  );
  let scopedPlayerIds: Set<number>;
  if ("seasonId" in seasonFilters.player) {
    const seasonId = (seasonFilters.player as { seasonId: number }).seasonId;
    const scopedRows = await db.$queryRawUnsafe<{ id: number }[]>(
      `SELECT p.ID_PLAYER as id FROM PLAYER p
       WHERE p.ID_PLAYER IN (${ph}) AND p.ID_SEASON = ?`,
      ...vs, seasonId
    );
    scopedPlayerIds = new Set(scopedRows.map((r) => Number(r.id)));
  } else {
    scopedPlayerIds = new Set(foundPlayers.map((r) => Number(r.id)));
  }

  for (const bid of bids) {
    if (!scopedPlayerIds.has(bid.playerId)) {
      return {
        error: `Joueur #${bid.playerId} inexistant ou hors perimetre de la saison courante.`,
        status: 400,
      };
    }
    const player = foundPlayers.find((p) => Number(p.id) === bid.playerId);
    if (player && isNamedGoalkeeper({ position: player.position, link: player.link })) {
      return {
        error: `Joueur #${bid.playerId} est un gardien nomme : misez sur le pseudo-joueur « Gardiens [Club] » correspondant.`,
        status: 400,
      };
    }
  }

  // B2-GK : au plus 1 gardien dans la mise (acquis compris)
  const wonPositionRows = await db.$queryRawUnsafe<{ position: string; amount: number }[]>(
    `SELECT p.POSITION as position, ab.amount as amount
     FROM AUCTION_BID ab JOIN PLAYER p ON ab.player_id = p.ID_PLAYER
     WHERE ab.auction_id = ? AND ab.user_id = ? AND ab.status = 'won'`,
    auctionId, userId
  );
  const draftPositionRows = await db.$queryRawUnsafe<{ position: string }[]>(
    `SELECT p.POSITION as position FROM PLAYER p WHERE p.ID_PLAYER IN (${ph})`,
    ...vs
  );
  const { rejected, totalGoalkeepers } = checkGoalkeeperLimit(wonPositionRows, draftPositionRows);
  if (rejected) {
    return {
      error: `Soumission refusée : votre mise contient ${totalGoalkeepers} gardiens (acquis compris). Maximum autorisé : 1 (règle 2026-06-11).`,
      status: 400,
    };
  }

  // HARD : garde-fou ferme (décision 2026-08-10). Budget restant = budget du
  // tour (130) moins les points des acquisitions conservées : ce sont les
  // MÊMES chiffres que ceux affichés au participant (GET /api/auction).
  const [auctionRow] = await db.$queryRawUnsafe<{ budget_per_user: number }[]>(
    `SELECT budget_per_user FROM AUCTION WHERE id = ?`,
    auctionId
  );
  const wonSpent = wonPositionRows.reduce((s, r) => s + Number(r.amount), 0);
  const hardErrors = findHardLimitErrors({
    ownedLines: wonPositionRows.map((r) => lineFromPosition(r.position)),
    bidLines: draftPositionRows.map((r) => lineFromPosition(r.position)),
    bidTotal: bids.reduce((s, b) => s + b.amount, 0),
    budgetLeft: Number(auctionRow?.budget_per_user ?? 0) - wonSpent,
  });
  if (hardErrors.length > 0) {
    return { error: hardErrors.join(" "), status: 400 };
  }

  return null;
}
