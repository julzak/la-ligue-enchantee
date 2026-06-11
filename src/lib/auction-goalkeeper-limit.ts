/**
 * Règle : une mise ne peut pas contenir plus d'UN gardien (acquis compris).
 *
 * Décision Julien 2026-06-11 (docs/regles-encheres.md §7) :
 *   - C'est le SEUL cas de rejet pour motif de composition.
 *   - Toutes les autres infractions de composition restent des pénalités
 *     appliquées au dépouillement (philosophie « le règlement pénalise,
 *     il n'interdit pas »).
 *   - Justification : aucune pénalité du tableau 3.2.c ne couvre l'excès
 *     de gardiens ; un effectif final à 2 gardiens bloquerait la clôture
 *     de phase (effectif invalide sans remède).
 *
 * Les gardiens détectés sont les pseudo-joueurs « Gardiens [Club] »
 * (position contenant « gardien », insensible à la casse). Les gardiens
 * nommés sont déjà rejetés individuellement par la garde B1 (route.ts).
 *
 * Ce module est importé par :
 *   - src/app/api/auction/route.ts  (garde serveur B2-GK)
 *   - src/lib/auction-goalkeeper-limit.test.ts  (tests unitaires)
 *   - src/app/ligue/[slug]/encheres/page.tsx  (erreur bloquante UI)
 */

export interface GkPlayerLike {
  position: string;
}

/**
 * Retourne true si la position indique un gardien
 * (même règle que isGoalkeeperPosition dans club-goalkeeper.ts).
 */
function isGkPosition(position: string): boolean {
  return position.toLowerCase().includes("gardien");
}

/**
 * Compte les gardiens dans un groupe de joueurs.
 */
export function countGoalkeepers(players: GkPlayerLike[]): number {
  return players.filter((p) => isGkPosition(p.position)).length;
}

/**
 * B2-GK — Vérifie la règle "max 1 gardien dans la mise (acquis compris)".
 *
 * @param ownedPositions  Positions des joueurs déjà acquis (won) par le participant.
 * @param draftPositions  Positions des joueurs dans les nouvelles mises draft.
 * @returns               Nombre total de gardiens (acquis + mises). 0 ou 1 = OK. > 1 = rejet.
 */
export function checkGoalkeeperLimit(
  ownedPositions: GkPlayerLike[],
  draftPositions: GkPlayerLike[]
): { totalGoalkeepers: number; rejected: boolean } {
  const totalGoalkeepers = countGoalkeepers([...ownedPositions, ...draftPositions]);
  return { totalGoalkeepers, rejected: totalGoalkeepers > 1 };
}
