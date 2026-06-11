/**
 * Logique pure de gestion de la deadline des tours d'enchères.
 *
 * Ce module est importé par :
 *   - src/app/api/auction/route.ts  (rejet des mises après butoir)
 *   - src/app/api/admin/auction/route.ts  (garde-fou deadline passée)
 *   - src/lib/auction-deadline.test.ts  (tests unitaires)
 *
 * Contrat du brief :
 *   "soumission à T+1 s → rejet" (tolérance 0, >= fait foi)
 */

/**
 * Vérifie si la deadline est dépassée au sens strict.
 * Renvoie true si now >= deadline (tolérance 0).
 * Renvoie false si deadline est null (pas de butoir renseigné).
 */
export function isDeadlinePassed(deadline: Date | null, now: Date): boolean {
  if (deadline === null) return false;
  return now >= deadline;
}

/**
 * Formate le message de rejet (même logique que dans la route POST).
 */
export function deadlineErrorMessage(deadline: Date): string {
  const fmt = deadline.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
  return `Tour clôturé le ${fmt} — aucune mise acceptée après l'heure butoir.`;
}
