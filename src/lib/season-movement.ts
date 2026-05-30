// Calcul pur des montées/descentes (chantier 4). AUCUNE dépendance (pas de db.ts
// ni react.cache) pour rester testable hors RSC via scripts/test-*.ts.

export type MovementKind = "PROMOTION" | "RELEGATION" | "STAY";

/**
 * Règle : 3 premiers montent (tier-1), 3 derniers descendent (tier+1).
 * Bornes : pas de montée depuis le tier le plus haut (minTier), pas de descente
 * depuis le plus bas (maxTier). Chevauchement (petite ligue, n<=6) : la montée
 * est prioritaire car elle concerne les meilleurs rangs.
 */
export function computeMovement(
  rank: number,
  n: number,
  tier: number,
  minTier: number,
  maxTier: number
): { type: MovementKind; toTier: number } {
  const isTop3 = rank <= 3;
  const isBottom3 = rank > n - 3;
  if (isTop3 && tier > minTier) return { type: "PROMOTION", toTier: tier - 1 };
  if (isBottom3 && tier < maxTier) return { type: "RELEGATION", toTier: tier + 1 };
  return { type: "STAY", toTier: tier };
}
