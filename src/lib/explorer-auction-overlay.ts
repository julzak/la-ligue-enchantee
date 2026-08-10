/**
 * Logique pure : superposition des acquisitions d'enchères sur la propriété
 * TEAM pour l'explorateur, PENDANT la phase d'enchères d'été.
 *
 * Contexte (remontée Pierre 2026-08-10) : TEAM n'est écrite qu'à la clôture
 * de la phase (statut AUCTION 'resolved', BRIEF-05). Pendant les tours, les
 * joueurs attribués vivent dans AUCTION_BID (status='won') et l'explorateur
 * les affichait « Libre ». Les acquisitions sont publiques pendant les tours
 * (décision du 2026-08-10, docs/regles-encheres.md section 7) : l'overlay ne
 * révèle que des informations déjà consultables dans l'onglet Résultats.
 *
 * Importé par :
 *   - src/lib/db.ts (getClubsWithStats)
 *   - src/lib/explorer-auction-overlay.test.ts
 */

/**
 * La phase d'enchères est active tant que l'enchère n'est pas 'resolved'
 * (cycle open → closed → tallied → resolved, cf src/app/api/admin/auction).
 * Hors phase active, TEAM est la seule source de vérité : à la clôture les
 * effectifs incluent complétions d'office et retraits, que les won bruts ne
 * reflètent pas.
 */
export function isAuctionPhaseActive(status: string | null | undefined): boolean {
  return status != null && status !== "resolved";
}

export interface WonOwnerRow {
  playerId: number;
  ownerName: string;
}

/**
 * Ajoute les propriétaires issus des mises won à la carte TEAM existante.
 * TEAM garde la priorité en cas de recouvrement : si une ligne TEAM existe
 * déjà pour un joueur, elle reflète l'état clos, plus fiable que la mise.
 * Retourne une nouvelle Map, l'entrée n'est pas mutée.
 */
export function overlayAuctionOwners(
  teamOwners: Map<number, string>,
  wonRows: WonOwnerRow[]
): Map<number, string> {
  const merged = new Map(teamOwners);
  for (const row of wonRows) {
    if (!merged.has(row.playerId)) {
      merged.set(row.playerId, row.ownerName);
    }
  }
  return merged;
}
