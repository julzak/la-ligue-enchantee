import { describe, it, expect } from "vitest";
import { resolveEffectiveLineup, type EffectiveLineupEntry } from "./effective-lineup";

// Cas réel : Charles Al-khelaifi, L3, J10 (2026-2027). Dernière compo validée
// en J8, rien en J9 ni en J10. Effectif de 13 : Mukau et Bretelle arrivés en J3
// (donc en fin de TEAM), Dier et Mayenda remplaçants dans la compo J8.
const ID = {
  lille: 1, ngoy: 2, diaz: 3, dier: 4, bacher: 5, mbappe: 6, rongier: 7,
  diop: 8, cuisance: 9, doue: 10, mayenda: 11, mukau: 12, bretelle: 13,
} as const;
const lineup = (ids: number[]): EffectiveLineupEntry[] => ids.map((playerId, i) => ({ playerId, indx: i + 1 }));

const compoJ8 = lineup([ID.lille, ID.diaz, ID.bacher, ID.ngoy, ID.rongier, ID.diop, ID.bretelle, ID.cuisance, ID.mbappe, ID.mukau, ID.doue]);
// TEAM dans l'ordre de la base : les arrivées de J3 en dernier
const teamOrder = [ID.ngoy, ID.mbappe, ID.doue, ID.rongier, ID.diaz, ID.diop, ID.dier, ID.bacher, ID.lille, ID.cuisance, ID.mayenda, ID.mukau, ID.bretelle];
const teamFallback = lineup(teamOrder.slice(0, 11));
const active = new Set<number>(teamOrder);

// Ancienne règle (bug) : jour, veille, puis 11 premières lignes de TEAM.
function oldRule(byDay: Map<number, EffectiveLineupEntry[]>, day: number) {
  return byDay.get(day) ?? byDay.get(day - 1) ?? teamFallback;
}

const ids = (l: EffectiveLineupEntry[]) => l.map((e) => e.playerId).sort((a, b) => a - b);

describe("repli de compo : dernière compo validée, même ancienne", () => {
  it("sanity-check : l'ancienne règle alignait Dier et Mayenda à la place de Bretelle et Mukau", () => {
    const old = oldRule(new Map([[8, compoJ8]]), 10);
    expect(ids(old)).toContain(ID.dier);
    expect(ids(old)).toContain(ID.mayenda);
    expect(ids(old)).not.toEqual(ids(compoJ8)); // le test ci-dessous détecterait la régression
  });

  it("deux journées sans compo : on reprend la compo J8", () => {
    const res = resolveEffectiveLineup({ today: [], lastSaved: compoJ8, activePlayerIds: active, teamFallback });
    expect(ids(res)).toEqual(ids(compoJ8));
  });

  it("compo du jour présente : elle prime", () => {
    const today = lineup([ID.lille, ID.ngoy, ID.diaz, ID.dier, ID.bacher, ID.mbappe, ID.rongier, ID.diop, ID.cuisance, ID.doue, ID.mayenda]);
    const res = resolveEffectiveLineup({ today, lastSaved: compoJ8, activePlayerIds: active, teamFallback });
    expect(res).toBe(today);
  });

  it("un joueur sorti de l'effectif depuis la dernière compo n'est plus aligné", () => {
    const sansMukau = new Set(teamOrder.filter((p) => p !== ID.mukau));
    const res = resolveEffectiveLineup({ today: [], lastSaved: compoJ8, activePlayerIds: sansMukau, teamFallback });
    expect(ids(res)).not.toContain(ID.mukau);
    expect(res).toHaveLength(10);
  });

  it("aucune compo jamais validée : repli sur les titulaires TEAM", () => {
    const res = resolveEffectiveLineup({ today: [], lastSaved: null, activePlayerIds: active, teamFallback });
    expect(res).toBe(teamFallback);
  });
});
