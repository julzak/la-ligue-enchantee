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
  /** Compteurs Prisma renvoyés par GET /api/admin/seasons (absents dans les vieux appels). */
  _count?: { clubs: number; players: number; leagues: number };
}

/**
 * Parmi une liste de saisons retournées par GET /api/admin/seasons,
 * trouve la saison à reprendre. Candidates :
 * - SETUP non-courante (une SETUP courante est un état anormal, exclu) ;
 * - AUCTION, courante OU non : depuis que "Ouvrir les enchères" marque la
 *   saison comme courante (scoping du module enchères), l'état normal de la
 *   phase enchères est AUCTION + isCurrent. L'exclure ferait retomber le
 *   wizard à l'étape 1 pendant toute la phase (régression du 2026-08-09).
 *
 * Les saisons ACTIVE, WINTER, CLOSED restent exclues pour éviter qu'ouvrir
 * "Nouvelle saison" en phase live saute à tort à l'étape d'import.
 *
 * Retourne la candidate la plus récente (id max), ou null si aucune.
 */
export function findResumableSeason(seasons: ResumableSeason[]): ResumableSeason | null {
  const candidates = seasons.filter(
    (s) => s.status === "AUCTION" || (s.status === "SETUP" && !s.isCurrent)
  );
  if (candidates.length === 0) return null;
  // La plus récente = id le plus élevé
  return candidates.reduce((best, s) => (s.id > best.id ? s : best));
}

/**
 * Détermine l'étape du stepper à afficher selon le statut d'une saison reprenable.
 *
 * SETUP   → première étape incomplète d'après les compteurs :
 *           0 club → étape 2 (import clubs/joueurs)
 *           0 ligue → étape 3 (ligues)
 *           sinon → étape 4 (participants)
 *           Sans compteurs fournis → étape 2 (comportement historique).
 * AUCTION → étape 5 (saison ouverte aux enchères, fin de préparation)
 * Autres  → null  (statut non reprenable, rester à l'étape 1)
 *
 * Le retour null indique à l'appelant qu'aucune reprise n'est applicable.
 */
export interface SeasonCounts {
  clubs: number;
  leagues: number;
}

export function resolveStepFromStatus(status: string, counts?: SeasonCounts): number | null {
  switch (status) {
    case "SETUP":
      if (!counts || counts.clubs === 0) return 2;
      if (counts.leagues === 0) return 3;
      return 4;
    case "AUCTION":
      return 5;
    default:
      return null;
  }
}
