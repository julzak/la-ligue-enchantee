/**
 * Logique pure de reprise d'une saison en cours pour la page admin "Nouvelle saison".
 *
 * Extrait pour être testable indépendamment du composant React.
 */

export interface ResumableSeason {
  id: number;
  label: string;
  status: string;
  isCurrent: boolean;
}

/**
 * Parmi une liste de saisons retournées par GET /api/admin/seasons,
 * trouve la saison à reprendre (non CLOSED, la plus récente = id max).
 *
 * Retourne null si toutes les saisons sont CLOSED ou si la liste est vide.
 */
export function findResumableSeason(seasons: ResumableSeason[]): ResumableSeason | null {
  const candidates = seasons.filter((s) => s.status !== "CLOSED");
  if (candidates.length === 0) return null;
  // La plus récente = id le plus élevé
  return candidates.reduce((best, s) => (s.id > best.id ? s : best));
}

/**
 * Détermine l'étape du stepper à afficher selon le statut d'une saison en cours.
 *
 * SETUP   → étape 2 (import clubs/joueurs)
 * AUCTION → étape 5 (saison ouverte aux enchères, fin de préparation)
 * Autres  → étape 2 par défaut (ACTIVE, WINTER : cas peu probable mais sûr)
 */
export function resolveStepFromStatus(status: string): number {
  switch (status) {
    case "AUCTION":
      return 5;
    case "SETUP":
    default:
      return 2;
  }
}
