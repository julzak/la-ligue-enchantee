/**
 * Logique pure : détection des joueurs déjà attribués à un autre participant.
 *
 * Ce module est importé par :
 *   - src/app/api/auction/route.ts  (garde serveur B0)
 *   - src/lib/auction-already-won.test.ts  (tests unitaires)
 *
 * Contrat :
 *   Un joueur ne peut pas être misé s'il a déjà été attribué (status='won')
 *   à un AUTRE participant lors de la même enchère (BRIEF-04).
 *   La vérification côté client n'est jamais la seule barrière : le serveur
 *   rejoue le contrôle systématiquement.
 */

export interface WonEntry {
  player_id: number;
  user_id: number;
}

export interface BidEntry {
  playerId: number;
}

/**
 * Retourne les playerId bloqués : déjà attribués à un autre participant.
 *
 * @param bids   Mises soumises par l'utilisateur courant
 * @param userId Identifiant de l'utilisateur courant
 * @param won    Lignes AUCTION_BID WHERE status='won' AND player_id IN (bids)
 */
export function findAlreadyWonByOther(
  bids: BidEntry[],
  userId: number,
  won: WonEntry[]
): number[] {
  const bidIds = new Set(bids.map((b) => b.playerId));
  return won
    .filter((w) => bidIds.has(Number(w.player_id)) && Number(w.user_id) !== userId)
    .map((w) => Number(w.player_id));
}
