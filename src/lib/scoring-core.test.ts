import { describe, it, expect } from "vitest";
import {
  computePlayerTotal,
  baseNoteAfterRedCard,
  goalBonusForPosition,
  SCORING_DEFAULTS,
  type ScoringConfig,
} from "./scoring-core";

const D = SCORING_DEFAULTS;

// Ancien bareme code EN DUR dans publish/route.ts avant l'unification. Sert de
// reference d'epinglage : le socle avec config par defaut doit reproduire ce
// calcul a l'identique (le refactor ne doit RIEN changer au classement).
function legacyHardcodedTotal(
  points: number, goals: number, passes: number, pos: "GK" | "DEF" | "MID" | "ATT",
  redCard = false, ownGoals = 0, penaltySaved = 0
): number {
  const pts = redCard ? 0 : points;
  const goalBonus = pos === "GK" ? 10 : pos === "DEF" ? 4 : 2;
  return Math.max(0, pts + goalBonus * goals + passes - 2 * ownGoals + 2 * penaltySaved);
}

describe("scoring-core : bareme (source unique de verite classement + affichage)", () => {
  describe("les 4 cas du bareme (CLAUDE.md)", () => {
    it("cas 2 — carton rouge : note a 0, bonus buts/passes CONSERVES", () => {
      // Defenseur note 6, carton rouge, 1 but + 1 passe.
      const t = computePlayerTotal(
        { points: 6, goals: 1, passes: 1, position: "DEF", redCard: true }, D
      );
      // base 0 (rouge) + 4 (but DEF) + 1 (passe) = 5. La note 6 est bien effacee.
      expect(t).toBe(5);
    });

    it("cas 4 — joue mais non note par L'Equipe = 2 (saisi a la main)", () => {
      const t = computePlayerTotal({ points: 2, goals: 0, passes: 0, position: "MID" }, D);
      expect(t).toBe(2);
    });

    it("cas 1 & 3 — forfait / pas de ligne SCORE = 0 (equivalent : note 0)", () => {
      // Le moteur ignore les joueurs sans ligne resoluble (publish : `continue`).
      // Pour un joueur avec une note 0 saisie, le total est bien 0, jamais 2.
      const t = computePlayerTotal({ points: 0, goals: 0, passes: 0, position: "ATT" }, D);
      expect(t).toBe(0);
    });
  });

  describe("bonus par poste (defaut)", () => {
    it("but GK = +10, DEF = +4, MID = +2, ATT = +2", () => {
      expect(computePlayerTotal({ points: 0, goals: 1, passes: 0, position: "GK" }, D)).toBe(10);
      expect(computePlayerTotal({ points: 0, goals: 1, passes: 0, position: "DEF" }, D)).toBe(4);
      expect(computePlayerTotal({ points: 0, goals: 1, passes: 0, position: "MID" }, D)).toBe(2);
      expect(computePlayerTotal({ points: 0, goals: 1, passes: 0, position: "ATT" }, D)).toBe(2);
    });
    it("resout aussi les libelles DB (gardien/defense/milieu)", () => {
      expect(goalBonusForPosition("Gardien", D)).toBe(10);
      expect(goalBonusForPosition("Défense", D)).toBe(4);
      expect(goalBonusForPosition("Milieu", D)).toBe(2);
      expect(goalBonusForPosition("Attaquant", D)).toBe(2);
    });
  });

  describe("csc, penalty, plancher", () => {
    it("csc = -2 par but contre son camp", () => {
      expect(computePlayerTotal({ points: 5, goals: 0, passes: 0, position: "DEF", ownGoals: 1 }, D)).toBe(3);
    });
    it("penalty arrete = +2", () => {
      expect(computePlayerTotal({ points: 5, goals: 0, passes: 0, position: "GK", penaltySaved: 1 }, D)).toBe(7);
    });
    it("plancher minNote (0 par defaut) : total negatif -> 0", () => {
      expect(computePlayerTotal({ points: 0, goals: 0, passes: 0, position: "DEF", ownGoals: 2 }, D)).toBe(0);
    });
  });

  describe("epinglage : config par defaut == ancien calcul en dur", () => {
    const cases: Array<[number, number, number, "GK" | "DEF" | "MID" | "ATT", boolean, number, number]> = [
      [7, 0, 0, "MID", false, 0, 0],
      [6, 1, 2, "DEF", false, 0, 0],
      [5, 2, 1, "GK", false, 0, 1],
      [6, 1, 1, "ATT", true, 0, 0],
      [4, 0, 0, "DEF", false, 1, 0],
      [0, 0, 0, "ATT", false, 3, 0],
    ];
    it.each(cases)(
      "note=%i buts=%i passes=%i pos=%s rouge=%s csc=%i pen=%i",
      (points, goals, passes, pos, redCard, ownGoals, penaltySaved) => {
        const modern = computePlayerTotal(
          { points, goals, passes, position: pos, redCard, ownGoals, penaltySaved }, D
        );
        const legacy = legacyHardcodedTotal(points, goals, passes, pos, redCard, ownGoals, penaltySaved);
        expect(modern).toBe(legacy);
      }
    );
  });

  describe("bareme pilote par la config (finding #3)", () => {
    it("changer goalBonusDef 4->5 change le total (le classement suit)", () => {
      const cfg: ScoringConfig = { ...D, goalBonusDef: 5 };
      expect(computePlayerTotal({ points: 0, goals: 1, passes: 0, position: "DEF" }, cfg)).toBe(5);
    });
    it("redCardNoteZero=false : le carton rouge CONSERVE la note", () => {
      const cfg: ScoringConfig = { ...D, redCardNoteZero: false };
      expect(computePlayerTotal({ points: 6, goals: 0, passes: 0, position: "MID", redCard: true }, cfg)).toBe(6);
      expect(baseNoteAfterRedCard(6, true, cfg)).toBe(6);
    });
    it("minNote=2 : plancher releve a 2", () => {
      const cfg: ScoringConfig = { ...D, minNote: 2 };
      expect(computePlayerTotal({ points: 0, goals: 0, passes: 0, position: "DEF", ownGoals: 5 }, cfg)).toBe(2);
    });
  });

  describe("SANITY : ces tests detectent bien les regressions qu'ils gardent", () => {
    it("un carton rouge qui NE remettrait PAS la note a 0 (bug) serait attrape", () => {
      // Si on regressait vers base=points sur carton rouge, ce total vaudrait 7, pas 1.
      const t = computePlayerTotal({ points: 6, goals: 0, passes: 1, position: "ATT", redCard: true }, D);
      expect(t).toBe(1);
      expect(t).not.toBe(7);
    });
    it("re-coder le bareme en dur (ignorer la config) serait attrape", () => {
      // goalBonusDef configure a 9 : un moteur qui garderait 4 en dur echouerait.
      const cfg: ScoringConfig = { ...D, goalBonusDef: 9 };
      expect(computePlayerTotal({ points: 0, goals: 1, passes: 0, position: "DEF" }, cfg)).not.toBe(4);
    });
  });
});
