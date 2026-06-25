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
 * trouve la saison à reprendre. Seules les saisons EN PRÉPARATION sont
 * candidates : status ∈ {"SETUP","AUCTION"} ET isCurrent === false.
 *
 * Les saisons ACTIVE, WINTER, CLOSED ou isCurrent sont exclues pour éviter
 * qu'ouvrir "Nouvelle saison" en phase live saute à tort à l'étape d'import.
 *
 * Retourne la candidate la plus récente (id max), ou null si aucune.
 */
export function findResumableSeason(seasons: ResumableSeason[]): ResumableSeason | null {
  const RESUMABLE_STATUSES = new Set(["SETUP", "AUCTION"]);
  const candidates = seasons.filter(
    (s) => RESUMABLE_STATUSES.has(s.status) && !s.isCurrent
  );
  if (candidates.length === 0) return null;
  // La plus récente = id le plus élevé
  return candidates.reduce((best, s) => (s.id > best.id ? s : best));
}

/**
 * Détermine l'étape du stepper à afficher selon le statut d'une saison reprenable.
 *
 * SETUP   → étape 2 (import clubs/joueurs)
 * AUCTION → étape 5 (saison ouverte aux enchères, fin de préparation)
 * Autres  → null  (statut non reprenable, rester à l'étape 1)
 *
 * Le retour null indique à l'appelant qu'aucune reprise n'est applicable.
 */
export function resolveStepFromStatus(status: string): number | null {
  switch (status) {
    case "SETUP":
      return 2;
    case "AUCTION":
      return 5;
    default:
      return null;
  }
}
