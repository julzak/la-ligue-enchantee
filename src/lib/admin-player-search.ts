// Construction de la requête de recherche joueurs de l'écran Admin → Joueurs.
// Extraite de la route pour être testable hors DB (vitest).
//
// Par défaut la recherche est scopée à la saison courante : la recherche non
// scopée renvoyait les fiches de TOUTES les saisons (ex. « 3 Gauthier Hein »,
// signalé par Thomas), que les admins prenaient pour des doublons à supprimer
// alors qu'elles portent l'historique des scores. Le mode « toutes saisons »
// reste disponible pour les besoins d'archives. Fallback legacy (aucune
// saison courante) : pas de filtre, comportement historique.

export interface PlayerSearchQuery {
  sql: string;
  params: (string | number)[];
}

export function buildPlayerSearchQuery(
  search: string,
  currentSeasonId: number | null,
  allSeasons: boolean
): PlayerSearchQuery {
  const like = `%${search}%`;
  const params: (string | number)[] = [like, like];
  let where = "(p.LNAME LIKE ? OR p.FNAME LIKE ?)";
  if (!allSeasons && currentSeasonId !== null) {
    where += " AND p.ID_SEASON = ?";
    params.push(currentSeasonId);
  }
  const sql =
    `SELECT p.ID_PLAYER, p.FNAME, p.LNAME, p.POSITION, p.ID_CLUB, ` +
    `COALESCE(c.NAME, '') as clubName, COALESCE(s.LABEL, '') as seasonLabel ` +
    `FROM PLAYER p ` +
    `LEFT JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB ` +
    `LEFT JOIN SEASON s ON p.ID_SEASON = s.ID_SEASON ` +
    `WHERE ${where} ` +
    `ORDER BY p.LNAME ASC LIMIT 50`;
  return { sql, params };
}
