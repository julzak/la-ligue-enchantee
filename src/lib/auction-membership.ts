/**
 * Logique d'appartenance à une ligue pour les routes API enchères.
 *
 * Extrait pour être testable en vitest sans mock Prisma.
 * La route /api/auction/results utilise isMember() après avoir fait :
 *   SELECT COUNT(*) as cnt FROM LEAGUE_USER WHERE ID_LEAGUE = ? AND ID_USER = ?
 */

/**
 * Retourne true si le user est membre de la ligue (count > 0).
 * Utilisé par /api/auction/results pour le contrôle B1 (fuite inter-ligues).
 */
export function isMember(memberCount: number): boolean {
  return memberCount > 0;
}
