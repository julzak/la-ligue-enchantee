// Helpers communs aux tests du contrat enchères (scripts/test-encheres-*.ts).
// Convention repo : chaque test inclut un sanity-check qui prouve qu'il
// détecterait la régression qu'il garde (simulation du comportement bugué
// passée au même détecteur, qui doit alors échouer).

import type { EnginePlayer, Line } from "../../src/lib/auction-engine";

let nextId = 1;
export function player(lastName: string, line: Line): EnginePlayer {
  return { id: nextId++, lastName, line };
}

// Effectif de mise valide : 13 joueurs (1 GK, 4 DEF, 5 MID, 3 ATT).
// Les noms sont préfixés pour rester uniques par participant.
export function validSquad(prefix: string): EnginePlayer[] {
  return [
    player(`${prefix}-gk`, "GK"),
    ...["d1", "d2", "d3", "d4"].map((n) => player(`${prefix}-${n}`, "DEF")),
    ...["m1", "m2", "m3", "m4", "m5"].map((n) => player(`${prefix}-${n}`, "MID")),
    ...["a1", "a2", "a3"].map((n) => player(`${prefix}-${n}`, "ATT")),
  ];
}

let failures = 0;
export function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "OK " : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (attendu ${JSON.stringify(expected)})`}`
  );
}

export function finish() {
  if (failures > 0) {
    console.error(`\n${failures} échec(s)`);
    process.exit(1);
  }
  console.log("\nTous les tests passent.");
}
