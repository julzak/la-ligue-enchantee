import { describe, it, expect } from "vitest";
import { POSITIONS, normalizePosition } from "./player-position";

describe("normalizePosition : postes legacy mappés vers le référentiel moderne", () => {
  // Sanity-check : les valeurs legacy réelles (base historique) ne sont PAS
  // dans POSITIONS. C'est exactement la condition qui faisait retomber le
  // select d'édition sur "Gardien" et écraser le poste à la sauvegarde.
  it("sanity-check : une valeur legacy brute n'est pas un poste moderne", () => {
    for (const legacy of ["1 - Gardien", "2 - Défense", "3 - Milieu", "4 - Attaque"]) {
      expect(POSITIONS.includes(legacy)).toBe(false);
    }
  });

  it("mappe les 4 formats legacy relevés en base", () => {
    expect(normalizePosition("1 - Gardien")).toBe("Gardien");
    expect(normalizePosition("2 - Défense")).toBe("Défense");
    expect(normalizePosition("3 - Milieu")).toBe("Milieu");
    expect(normalizePosition("4 - Attaque")).toBe("Attaque");
  });

  it("laisse passer les postes modernes tels quels", () => {
    for (const p of POSITIONS) {
      expect(normalizePosition(p)).toBe(p);
    }
  });

  it("tolère les variations d'espaces autour du tiret", () => {
    expect(normalizePosition("3- Milieu")).toBe("Milieu");
    expect(normalizePosition("3 -Milieu")).toBe("Milieu");
    expect(normalizePosition("  4 - Attaque  ")).toBe("Attaque");
  });

  it("retourne null pour une valeur inconnue (pas de fallback silencieux)", () => {
    expect(normalizePosition("5 - Libéro")).toBeNull();
    expect(normalizePosition("Defenseur")).toBeNull();
    expect(normalizePosition("")).toBeNull();
  });
});
