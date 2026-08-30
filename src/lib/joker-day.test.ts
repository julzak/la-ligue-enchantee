import { describe, it, expect } from "vitest";
import { computeJokerEffectDay, jokerCutoffFor } from "./joker-day-core";

// Calendrier J1/J2 2026-2027 réel : J1 premier match vendredi 21/08 20h45,
// J2 premier match vendredi 28/08.
const SCHEDULE = new Map<number, string>([
  [1, "2026-08-21"],
  [2, "2026-08-28"],
  [3, "2026-09-11"],
]);

// Heure de Paris (CEST, UTC+2) -> instant UTC.
const paris = (iso: string) => new Date(`${iso}+02:00`);

describe("cutoff joker : 18h la veille du premier match (tolérance zéro)", () => {
  it("J1 : cutoff jeudi 20/08 18h00 Paris", () => {
    expect(jokerCutoffFor("2026-08-21").toISOString()).toBe(paris("2026-08-20T18:00:00").toISOString());
  });

  it("jeudi 17h59 -> J1, jeudi 18h00 pile -> J2", () => {
    expect(computeJokerEffectDay(paris("2026-08-20T17:59:59"), 0, SCHEDULE).effectDay).toBe(1);
    expect(computeJokerEffectDay(paris("2026-08-20T18:00:00"), 0, SCHEDULE).effectDay).toBe(2);
  });

  it("cas réels J1 2026-2027 : Skippy vendredi 14h52 et LST samedi 00h07 -> J2", () => {
    expect(computeJokerEffectDay(new Date("2026-08-21T12:52:56Z"), 0, SCHEDULE).effectDay).toBe(2);
    expect(computeJokerEffectDay(new Date("2026-08-21T22:07:44Z"), 0, SCHEDULE).effectDay).toBe(2);
  });

  it("Martial et Nums jeudi matin -> J1 (avant le cutoff)", () => {
    expect(computeJokerEffectDay(new Date("2026-08-20T07:26:14Z"), 0, SCHEDULE).effectDay).toBe(1);
  });

  it("sanity-check : l'ancienne règle (dernière publiée + 1) aurait donné J1 pour Skippy", () => {
    const oldRule = (currentDay: number) => currentDay + 1;
    expect(oldRule(0)).toBe(1);
    expect(computeJokerEffectDay(new Date("2026-08-21T12:52:56Z"), 0, SCHEDULE).effectDay).not.toBe(oldRule(0));
  });

  it("saute plusieurs journées si leurs cutoffs sont passés (publication en retard)", () => {
    // J1 et J2 passées mais rien publié (currentDay=0) : un joker du 30/08 vise J3.
    expect(computeJokerEffectDay(paris("2026-08-30T10:00:00"), 0, SCHEDULE).effectDay).toBe(3);
  });

  it("journée sans calendrier connu : ouverte (currentDay + 1)", () => {
    expect(computeJokerEffectDay(paris("2026-08-30T10:00:00"), 5, SCHEDULE)).toEqual({ effectDay: 6, cutoff: null });
  });

  it("en saison : currentDay = dernière publiée, effet = suivante si cutoff non passé", () => {
    expect(computeJokerEffectDay(paris("2026-08-25T10:00:00"), 1, SCHEDULE).effectDay).toBe(2);
    expect(computeJokerEffectDay(paris("2026-08-27T18:00:00"), 1, SCHEDULE).effectDay).toBe(3);
  });
});

// ── Journée d'évaluation de la propriété (lectures) ─────────────────────
// Les lectures (explorateur getClubsWithStats, /api/admin/jokers/free)
// doivent évaluer « pris/libre » à effectDay, la journée où applyJokerSwap
// écrit (entrant DAY_FIRST=effectDay, sortant DAY_LAST=effectDay-1) et où
// POST /api/jokers valide « entrant libre ». Prédicat identique au WHERE
// SQL des deux lectures : dayFirst <= d AND dayLast >= d.
const takenOn = (dayFirst: number, dayLast: number, d: number) => dayFirst <= d && dayLast >= d;

describe("propriété évaluée à effectDay, pas à « dernière publiée + 1 »", () => {
  // Cas réel confirmé en prod le 2026-08-30 (remontée Pierre) : J1 publiée
  // (currentDay=1), cutoff J2 passé (28/08), jokers écrits pour la J3.
  const now = paris("2026-08-30T20:36:00");
  const currentDay = 1;
  const { effectDay } = computeJokerEffectDay(now, currentDay, SCHEDULE);

  it("entre cutoff J2 et publication J2, un joker s'applique à la J3", () => {
    expect(effectDay).toBe(3);
  });

  it("évalués à effectDay : l'entrant (Yassine, DAY_FIRST=3) est pris, le sortant (Bakwa, DAY_LAST=2) est libre", () => {
    expect(takenOn(effectDay, 38, effectDay)).toBe(true); // entrant du joker
    expect(takenOn(2, effectDay - 1, effectDay)).toBe(false); // sortant du joker
  });

  it("sanity-check : l'ancienne journée de lecture (currentDay + 1) reproduit le bug", () => {
    const oldRosterDay = currentDay + 1; // ancien code de db.ts:927 et jokers/free
    expect(oldRosterDay).not.toBe(effectDay);
    expect(takenOn(effectDay, 38, oldRosterDay)).toBe(false); // Yassine affiché « Libre »
    expect(takenOn(2, effectDay - 1, oldRosterDay)).toBe(true); // Bakwa absent des libres
  });
});
