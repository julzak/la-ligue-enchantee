/**
 * Logique pure : détection des joueurs déjà attribués.
 *
 * Ce module est importé par :
 *   - src/app/api/auction/route.ts  (gardes serveur B0 et B0b)
 *   - src/lib/auction-already-won.test.ts  (tests unitaires)
 *
 * Contrat :
 *   B0  — Un joueur ne peut pas être misé s'il a déjà été attribué (status='won')
 *         à un AUTRE participant lors de la même enchère (BRIEF-04).
 *   B0b — Un joueur ne peut pas être misé s'il a déjà été attribué AU PARTICIPANT
 *         LUI-MÊME : règle 3.1, les acquis sont reportés automatiquement sans
 *         nouvelle mise. Empêche un double won + double décompte budget au
 *         dépouillement (faille PR #9).
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
 * B0 — Retourne les playerId bloqués : déjà attribués à un AUTRE participant.
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

/**
 * B0b — Retourne les playerId bloqués : déjà attribués AU PARTICIPANT LUI-MÊME.
 *
 * Règle 3.1 : un joueur déjà acquis par le participant est reporté
 * automatiquement dans son effectif ; une nouvelle mise sur ce joueur est
 * interdite (évite un double won et un double décompte du budget au
 * dépouillement).
 *
 * @param bids   Mises soumises par l'utilisateur courant
 * @param userId Identifiant de l'utilisateur courant
 * @param won    Lignes AUCTION_BID WHERE status='won' AND player_id IN (bids)
 */
export function findAlreadyWonBySelf(
  bids: BidEntry[],
  userId: number,
  won: WonEntry[]
): number[] {
  const bidIds = new Set(bids.map((b) => b.playerId));
  return won
    .filter((w) => bidIds.has(Number(w.player_id)) && Number(w.user_id) === userId)
    .map((w) => Number(w.player_id));
}
