// Postes joueurs : référentiel moderne + normalisation des valeurs legacy.
//
// L'historique (ancien site PHP) stocke des POSITION préfixées d'un numéro de
// ligne ("1 - Gardien", "2 - Défense", "3 - Milieu", "4 - Attaque"). Un select
// HTML qui ne connaît que les libellés modernes retombe silencieusement sur sa
// première option ("Gardien") face à une valeur legacy : toute sauvegarde
// écraserait alors le poste historique.

export const POSITIONS = ["Gardien", "Défense", "Milieu", "Attaque"];

// Retourne le libellé moderne équivalent, ou null si la valeur ne correspond
// à aucun poste connu (même après retrait d'un préfixe numérique legacy).
export function normalizePosition(raw: string): string | null {
  const cleaned = raw.trim().replace(/^\d+\s*-\s*/, "").trim();
  return POSITIONS.includes(cleaned) ? cleaned : null;
}
