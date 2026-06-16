/**
 * Logique pure : détection des playerId en doublon dans une même soumission.
 *
 * Ce module est importé par :
 *   - src/app/api/auction/route.ts  (garde serveur B3)
 *   - src/lib/auction-engine.test.ts  (tests unitaires)
 *
 * Contrat :
 *   B3 — Une soumission ne peut pas contenir deux mises sur le MÊME playerId.
 *        Un payload avec des doublons est malformé : il fausserait le décompte
 *        de joueurs (quotas, pénalité >13) et le dépouillement (deux lignes
 *        AUCTION_BID pour un seul joueur). La soumission est REJETÉE (garde
 *        d'entrée, pas une pénalité de composition).
 *   La vérification côté client n'est jamais la seule barrière : le serveur
 *   rejoue le contrôle systématiquement.
 */

export interface BidEntry {
  playerId: number;
}

/**
 * B3 — Retourne les playerId présents plus d'une fois dans la soumission.
 *
 * @param bids Mises soumises par l'utilisateur courant
 * @returns Liste dédupliquée des playerId en doublon (vide si soumission saine)
 */
export function findDuplicatePlayerIds(bids: BidEntry[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const b of bids) {
    const id = Number(b.playerId);
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }
  return Array.from(duplicates);
}
