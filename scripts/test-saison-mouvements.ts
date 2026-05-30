/**
 * Test de non-régression : calcul des montées/descentes (chantier 4).
 * Logique pure, sans DB. Inclut un sanity-check prouvant que le test
 * détecterait une régression sur la règle des bornes de tier.
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-saison-mouvements.ts
 */

import { computeMovement, type MovementKind } from "../src/lib/season-movement";

let failed = 0;
function check(name: string, got: { type: MovementKind; toTier: number }, expType: MovementKind, expTier: number) {
  const ok = got.type === expType && got.toTier === expTier;
  if (!ok) {
    failed++;
    console.error(`FAIL ${name} : attendu ${expType}/tier${expTier}, obtenu ${got.type}/tier${got.toTier}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// Ligue de tier 2 sur un éventail de tiers [1..3], 10 participants.
const minT = 1, maxT = 3, n = 10;

// 3 premiers montent en tier 1.
check("rang 1 (tier2) monte", computeMovement(1, n, 2, minT, maxT), "PROMOTION", 1);
check("rang 3 (tier2) monte", computeMovement(3, n, 2, minT, maxT), "PROMOTION", 1);
// 4e reste.
check("rang 4 (tier2) reste", computeMovement(4, n, 2, minT, maxT), "STAY", 2);
// 3 derniers descendent en tier 3.
check("rang 8 (tier2) descend", computeMovement(8, n, 2, minT, maxT), "RELEGATION", 3);
check("rang 10 (tier2) descend", computeMovement(10, n, 2, minT, maxT), "RELEGATION", 3);

// Borne haute : tier 1, les 3 premiers ne peuvent pas monter -> STAY.
check("rang 1 (tier1, top) reste", computeMovement(1, n, 1, minT, maxT), "STAY", 1);
// mais le tier 1 peut descendre.
check("rang 10 (tier1) descend", computeMovement(10, n, 1, minT, maxT), "RELEGATION", 2);

// Borne basse : tier 3, les 3 derniers ne peuvent pas descendre -> STAY.
check("rang 10 (tier3, bas) reste", computeMovement(10, n, 3, minT, maxT), "STAY", 3);
// mais le tier 3 peut monter.
check("rang 1 (tier3) monte", computeMovement(1, n, 3, minT, maxT), "PROMOTION", 2);

// Petite ligue (n=5) : chevauchement top3/bottom3 -> montée prioritaire.
check("petite ligue rang 3 monte (priorité)", computeMovement(3, 5, 2, minT, maxT), "PROMOTION", 1);

// ── Sanity-check : prouve que le test capte une régression de bornes ──
// Si computeMovement ignorait la borne haute (bug : laisserait monter le tier 1),
// rang 1 tier 1 donnerait PROMOTION/tier0. On vérifie que ce N'EST PAS le cas.
const topGuard = computeMovement(1, n, 1, minT, maxT);
if (topGuard.type === "PROMOTION" || topGuard.toTier < minT) {
  failed++;
  console.error("FAIL sanity : la borne haute de tier n'est pas respectée (régression détectée)");
} else {
  console.log("ok   sanity : borne haute de tier respectée");
}

if (failed > 0) {
  console.error(`\n${failed} test(s) en échec.`);
  process.exit(1);
}
console.log("\nTous les tests passent.");
