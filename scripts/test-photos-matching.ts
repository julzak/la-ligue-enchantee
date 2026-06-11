/**
 * Test de non-régression : matching des photos par nom, CLUB PAR CLUB
 * (src/lib/photo-sync.ts). Garde le risque n°1 du chantier effectifs :
 * en 2025-2026, le matching GLOBAL par recherche de nom n'avait trouvé que
 * 50 photos sur 1035 joueurs. Le matching par club doit apparier les
 * variantes courantes et REFUSER les cas ambigus (mieux vaut un trou signalé
 * qu'une mauvaise photo).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-photos-matching.ts
 */

import { normalizePlayerName, matchPlayerName } from "../src/lib/photo-sync";
import { check, finish } from "./lib/test-encheres-helpers";

console.log("── Normalisation");
check("accents", normalizePlayerName("Kylian Mbappé"), "kylian mbappe");
check("tirets/apostrophes", normalizePlayerName("N'Golo Kanté-Dupont"), "n golo kante dupont");
check("casse + espaces", normalizePlayerName("  LUCAS   Chevalier "), "lucas chevalier");

console.log("── Matching dans l'effectif d'un club");
const squad = [
  "Kylian Mbappé",
  "Lucas Chevalier",
  "Vanderson de Oliveira Campos",
  "Amine Gouiri",
  "Benjamin Pavard",
];
check("exact (accents différents)", matchPlayerName("Kylian Mbappe", squad), 0);
check("notre nom inclus dans le leur (Vanderson)", matchPlayerName("Vanderson Campos", squad), 2);
check("leur nom inclus dans le nôtre", matchPlayerName("Amine Gouiri Junior", squad), 3);
check("aucun candidat plausible", matchPlayerName("Zinedine Zidane", squad), -1);

console.log("── Ambiguïté = refus (jamais de mauvaise photo)");
const freres = ["Marcus Thuram", "Khephren Thuram"];
check("nom de famille seul, 2 candidats : refus", matchPlayerName("Thuram", freres), -1);
check("prénom discriminant : match", matchPlayerName("Marcus Thuram", freres), 0);

// ── Sanity-check : la régression 2025-2026 (matching global trop laxiste qui
// matchait au premier nom de famille venu) aurait apparié "Thuram" au premier
// candidat (index 0). Notre détecteur doit distinguer ce comportement bugué.
const buggyGlobalMatch = 0; // l'ancien comportement aurait pris le premier
check("sanity-check : la régression 'premier nom venu' serait détectée", buggyGlobalMatch !== matchPlayerName("Thuram", freres), true);

finish();
