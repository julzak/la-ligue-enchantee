import { describe, it, expect } from "vitest";
import { computeJokerQuota, type JokerPool } from "./joker-quota-core";

// Config 2026-2027 : 3 jokers d'août valables avant le 15 septembre,
// 4 jokers saison sans deadline. JOKER_CONFIG.deadline est une DATE : le
// driver la renvoie en Date UTC minuit, comme `new Date("2026-09-15")`.
const DEADLINE = new Date("2026-09-15");
const POOLS: JokerPool[] = [
  { type: "regular", maxCount: 4, deadline: null },
  { type: "summer", maxCount: 3, deadline: DEADLINE },
];

const AOUT_1 = new Date("2026-08-20T07:26:14Z");
const AOUT_2 = new Date("2026-08-21T12:52:56Z");
const AOUT_3 = new Date("2026-08-27T10:00:00Z");
const AOUT_4 = new Date("2026-09-03T10:00:00Z");
const AOUT_5 = new Date("2026-09-10T10:00:00Z");
const OCT_1 = new Date("2026-10-02T10:00:00Z");
const OCT_2 = new Date("2026-10-16T10:00:00Z");

const AVANT = new Date("2026-09-02T07:51:00Z"); // message de Pierre
const APRES = new Date("2026-09-20T10:00:00Z");

// Ancienne formule (les 5 points de calcul avant le fix) : plafond des pots
// ouverts − nb total de jokers posés, sans attribution par pot.
function ancienneFormule(now: Date, pools: JokerPool[], used: number): number {
  const max = pools.reduce((sum, c) => {
    if (c.deadline && new Date(c.deadline) < now) return sum;
    return sum + c.maxCount;
  }, 0);
  return max - used;
}

describe("quota jokers : avant la deadline d'août, rien ne change", () => {
  it("aucun joker posé : 7 restants", () => {
    const q = computeJokerQuota(AVANT, POOLS, []);
    expect(q.maxTotal).toBe(7);
    expect(q.used).toBe(0);
    expect(q.remaining).toBe(7);
  });

  it("2 jokers posés en août : 5 restants (identique à l'ancienne formule)", () => {
    const q = computeJokerQuota(AVANT, POOLS, [AOUT_1, AOUT_2]);
    expect(q.remaining).toBe(5);
    expect(q.remaining).toBe(ancienneFormule(AVANT, POOLS, 2));
  });

  it("5 jokers posés en août : 3 d'août + 2 saison, 2 restants", () => {
    const q = computeJokerQuota(AVANT, POOLS, [AOUT_1, AOUT_2, AOUT_3, AOUT_4, AOUT_5]);
    expect(q.remaining).toBe(2);
    expect(q.pools.find((p) => p.type === "summer")?.used).toBe(3);
    expect(q.pools.find((p) => p.type === "regular")?.used).toBe(2);
  });
});

describe("quota jokers : deadline d'août passée, les jokers d'août déjà posés ne sont pas re-décomptés", () => {
  it("bug Pierre 2026-09-02 : 2 jokers posés en août -> 4 restants, pas 2", () => {
    const q = computeJokerQuota(APRES, POOLS, [AOUT_1, AOUT_2]);
    expect(q.maxTotal).toBe(4);
    expect(q.used).toBe(2);
    expect(q.remaining).toBe(4);
  });

  it("sanity-check : l'ancienne formule faisait perdre 3 jokers à tout le monde", () => {
    // Participant avec 2 jokers d'août : 5 -> 2 (au lieu de 5 -> 4).
    expect(ancienneFormule(AVANT, POOLS, 2) - ancienneFormule(APRES, POOLS, 2)).toBe(3);
    expect(ancienneFormule(APRES, POOLS, 2)).not.toBe(computeJokerQuota(APRES, POOLS, [AOUT_1, AOUT_2]).remaining);
    // Participant avec 3 jokers d'août : 4 -> 1 avec l'ancienne formule, 4 -> 4 avec la nouvelle.
    expect(ancienneFormule(APRES, POOLS, 3)).toBe(1);
    expect(computeJokerQuota(APRES, POOLS, [AOUT_1, AOUT_2, AOUT_3]).remaining).toBe(4);
  });

  it("aucun joker posé : les 3 jokers d'août non utilisés sont perdus (règle), 4 restants", () => {
    const q = computeJokerQuota(APRES, POOLS, []);
    expect(q.remaining).toBe(4);
    expect(q.pools.find((p) => p.type === "summer")?.open).toBe(false);
  });

  it("5 jokers posés en août : 3 d'août + 2 saison, 2 restants", () => {
    const q = computeJokerQuota(APRES, POOLS, [AOUT_1, AOUT_2, AOUT_3, AOUT_4, AOUT_5]);
    expect(q.remaining).toBe(2);
  });

  it("2 en août + 1 en octobre : le joker d'octobre consomme le pot saison, 3 restants", () => {
    const q = computeJokerQuota(APRES, POOLS, [AOUT_1, AOUT_2, OCT_1]);
    expect(q.pools.find((p) => p.type === "summer")?.used).toBe(2);
    expect(q.pools.find((p) => p.type === "regular")?.used).toBe(1);
    expect(q.remaining).toBe(3);
  });

  it("joker posé après la deadline : jamais attribué au pot d'août même s'il restait de la place", () => {
    const q = computeJokerQuota(APRES, POOLS, [OCT_1, OCT_2]);
    expect(q.pools.find((p) => p.type === "summer")?.used).toBe(0);
    expect(q.remaining).toBe(2);
  });

  it("l'ordre d'arrivée des lignes JOKER_LOG n'influe pas : tri par date de pose", () => {
    expect(computeJokerQuota(APRES, POOLS, [OCT_1, AOUT_2, AOUT_1]).remaining).toBe(3);
  });
});

describe("quota jokers : cas limites", () => {
  it("tolérance zéro : joker posé pile à la deadline -> pot saison", () => {
    const q = computeJokerQuota(APRES, POOLS, [DEADLINE]);
    expect(q.pools.find((p) => p.type === "summer")?.used).toBe(0);
    expect(q.remaining).toBe(3);
  });

  it("à l'instant de la deadline, le pot d'août est fermé", () => {
    expect(computeJokerQuota(DEADLINE, POOLS, []).maxTotal).toBe(4);
    expect(computeJokerQuota(new Date(DEADLINE.getTime() - 1), POOLS, []).maxTotal).toBe(7);
  });

  it("created_at absent (ligne legacy) = posé avant toute deadline", () => {
    const q = computeJokerQuota(APRES, POOLS, [null, null]);
    expect(q.pools.find((p) => p.type === "summer")?.used).toBe(2);
    expect(q.remaining).toBe(4);
  });

  it("deadline et created_at en chaîne (driver) acceptés", () => {
    const pools: JokerPool[] = [
      { type: "regular", maxCount: 4, deadline: null },
      { type: "summer", maxCount: 3, deadline: "2026-09-15" },
    ];
    expect(computeJokerQuota(APRES, pools, ["2026-08-21 14:52:56", "2026-10-02 12:00:00"]).remaining).toBe(3);
  });

  it("dépassement forcé par un admin : restant négatif, comme avant", () => {
    const q = computeJokerQuota(APRES, POOLS, [AOUT_1, AOUT_2, AOUT_3, OCT_1, OCT_2, OCT_1, OCT_2, OCT_1]);
    expect(q.used).toBe(8);
    expect(q.remaining).toBe(-1);
  });

  it("config sans deadline (pot saison seul) : plafond − utilisés", () => {
    const pools: JokerPool[] = [{ type: "regular", maxCount: 4, deadline: null }];
    expect(computeJokerQuota(APRES, pools, [AOUT_1, OCT_1]).remaining).toBe(2);
  });

  it("aucune config active : 0 restant", () => {
    expect(computeJokerQuota(APRES, [], []).remaining).toBe(0);
  });
});
