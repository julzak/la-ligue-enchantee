/**
 * Tests du garde-fou ferme à la soumission (décision Julien 2026-08-10).
 *
 * Refus ferme = 13 joueurs max, budget restant max, maxima de ligne
 * (DEF > 6, MIL > 6, ATT > 4). Les minima de ligne restent des
 * avertissements non bloquants (couverts par auction-engine.test.ts).
 *
 * Chaque describe inclut un sanity-check qui prouve que le test
 * détecterait la régression qu'il garde.
 */

import { describe, it, expect } from "vitest";
import { findHardLimitErrors } from "./auction-hard-limits";
import type { Line } from "./auction-engine";

const lines = (spec: Partial<Record<Line, number>>): Line[] =>
  (Object.entries(spec) as [Line, number][]).flatMap(([l, n]) => Array(n).fill(l));

describe("garde-fou ferme : plus de 13 joueurs (acquis + mise)", () => {
  it("14 joueurs (11 acquis + 3 misés) : refus", () => {
    const errors = findHardLimitErrors({
      ownedLines: lines({ GK: 1, DEF: 5, MID: 5 }), // 11 acquis
      bidLines: lines({ ATT: 3 }),
      bidTotal: 10,
      budgetLeft: 19,
    });
    expect(errors.some((e) => e.includes("14 joueurs"))).toBe(true);
  });

  it("cas réel du tour 1 L2 : 14 joueurs / 131 pts, les deux refus remontent", () => {
    const errors = findHardLimitErrors({
      ownedLines: [],
      bidLines: lines({ GK: 1, DEF: 5, MID: 5, ATT: 3 }), // 14 joueurs
      bidTotal: 131,
      budgetLeft: 130,
    });
    expect(errors.some((e) => e.includes("14 joueurs"))).toBe(true);
    expect(errors.some((e) => e.includes("131 pts"))).toBe(true);
  });

  it("sanity-check : 13 joueurs pile, aucun refus", () => {
    const errors = findHardLimitErrors({
      ownedLines: lines({ GK: 1, DEF: 4, MID: 4 }),
      bidLines: lines({ DEF: 1, MID: 1, ATT: 2 }),
      bidTotal: 130,
      budgetLeft: 130,
    });
    expect(errors).toEqual([]);
  });
});

describe("garde-fou ferme : mise supérieure au budget restant", () => {
  // Cas du handoff : 11 acquis pour 111 pts → budget restant 19,
  // mise max 2 joueurs / 19 pts.
  it("tour N avec acquis : mise de 20 pts pour 19 restants : refus", () => {
    const errors = findHardLimitErrors({
      ownedLines: lines({ GK: 1, DEF: 5, MID: 5 }),
      bidLines: lines({ ATT: 2 }),
      bidTotal: 20,
      budgetLeft: 19,
    });
    expect(errors.some((e) => e.includes("budget restant (19 pts"))).toBe(true);
  });

  it("sanity-check : mise de 19 pts pour 19 restants (2 joueurs) : accepté", () => {
    const errors = findHardLimitErrors({
      ownedLines: lines({ GK: 1, DEF: 5, MID: 5 }),
      bidLines: lines({ ATT: 2 }),
      bidTotal: 19,
      budgetLeft: 19,
    });
    expect(errors).toEqual([]);
  });
});

describe("garde-fou ferme : maxima de ligne (acquis compris)", () => {
  it("5 attaquants misés + acquis : refus", () => {
    const errors = findHardLimitErrors({
      ownedLines: lines({ GK: 1, ATT: 2 }),
      bidLines: lines({ ATT: 3, DEF: 3, MID: 3 }),
      bidTotal: 50,
      budgetLeft: 130,
    });
    expect(errors.some((e) => e.includes("5 attaquants"))).toBe(true);
  });

  it("7 défenseurs : refus ; 7 milieux : refus", () => {
    const def = findHardLimitErrors({
      ownedLines: lines({ DEF: 4 }),
      bidLines: lines({ DEF: 3 }),
      bidTotal: 10,
      budgetLeft: 130,
    });
    expect(def.some((e) => e.includes("7 défenseurs"))).toBe(true);
    const mid = findHardLimitErrors({
      ownedLines: lines({ MID: 4 }),
      bidLines: lines({ MID: 3 }),
      bidTotal: 10,
      budgetLeft: 130,
    });
    expect(mid.some((e) => e.includes("7 milieux"))).toBe(true);
  });

  it("les MINIMA ne bloquent pas : 2 DEF au tour 1, aucun refus", () => {
    const errors = findHardLimitErrors({
      ownedLines: [],
      bidLines: lines({ GK: 1, DEF: 2, MID: 3, ATT: 1 }), // 7 joueurs, effectif en construction
      bidTotal: 70,
      budgetLeft: 130,
    });
    expect(errors).toEqual([]);
  });

  it("sanity-check : 6 DEF, 6 MIL, 4 ATT exactement, aucun refus de ligne", () => {
    const errors = findHardLimitErrors({
      ownedLines: lines({ GK: 1, DEF: 6 }),
      bidLines: lines({ MID: 6, ATT: 4 }), // 17 joueurs : seul le refus >13 doit sortir
      bidTotal: 50,
      budgetLeft: 130,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("17 joueurs");
  });
});
