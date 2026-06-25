/**
 * Garde de mutation de saison — logique pure, testable sans DB.
 *
 * Une saison est mutable (renommage, réinitialisation, suppression) UNIQUEMENT si :
 * - son statut est SETUP
 * - elle n'est PAS la saison courante (isCurrent === false)
 *
 * Les saisons ACTIVE, WINTER et CLOSED ne sont JAMAIS mutables :
 * - CLOSED porte le palmarès et l'historique, inviolable.
 * - ACTIVE/WINTER sont en cours de jeu, toute suppression serait catastrophique.
 * - isCurrent = la saison référencée par toute la plateforme, jamais touchée.
 */
export type SeasonStatus = "SETUP" | "AUCTION" | "ACTIVE" | "WINTER" | "CLOSED";

export interface MutationGuardInput {
  status: SeasonStatus;
  isCurrent: boolean;
}

export function canMutateSeason(season: MutationGuardInput): boolean {
  return season.status === "SETUP" && !season.isCurrent;
}

export function assertCanMutateSeason(season: MutationGuardInput): void {
  if (!canMutateSeason(season)) {
    throw new Error(
      `Impossible de modifier cette saison : statut=${season.status}, isCurrent=${season.isCurrent}. Seules les saisons en statut SETUP et non-courantes peuvent être modifiées.`
    );
  }
}
