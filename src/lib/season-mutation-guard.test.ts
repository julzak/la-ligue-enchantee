import { describe, it, expect } from "vitest";
import { canMutateSeason, assertCanMutateSeason } from "./season-mutation-guard";

describe("canMutateSeason", () => {
  // Cas autorisé : seul SETUP non-courant
  it("autorise SETUP non-courante", () => {
    expect(canMutateSeason({ status: "SETUP", isCurrent: false })).toBe(true);
  });

  // Sanity-check anti-régression : si ce test passe en retournant true pour CLOSED,
  // la logique est cassée et laisserait supprimer des palmarès.
  it("refuse CLOSED (le palmarès/historique doit être inviolable)", () => {
    const result = canMutateSeason({ status: "CLOSED", isCurrent: false });
    expect(result).toBe(false);
    // Vérification explicite : ce guard NE DOIT PAS retourner true pour CLOSED
    expect(result).not.toBe(true);
  });

  it("refuse ACTIVE", () => {
    expect(canMutateSeason({ status: "ACTIVE", isCurrent: false })).toBe(false);
  });

  it("refuse ACTIVE courante", () => {
    expect(canMutateSeason({ status: "ACTIVE", isCurrent: true })).toBe(false);
  });

  it("refuse WINTER", () => {
    expect(canMutateSeason({ status: "WINTER", isCurrent: false })).toBe(false);
  });

  it("refuse WINTER courante", () => {
    expect(canMutateSeason({ status: "WINTER", isCurrent: true })).toBe(false);
  });

  it("refuse SETUP courante (isCurrent = true)", () => {
    expect(canMutateSeason({ status: "SETUP", isCurrent: true })).toBe(false);
  });

  it("refuse AUCTION non-courante", () => {
    expect(canMutateSeason({ status: "AUCTION", isCurrent: false })).toBe(false);
  });

  it("refuse AUCTION courante", () => {
    expect(canMutateSeason({ status: "AUCTION", isCurrent: true })).toBe(false);
  });

  it("refuse CLOSED courante", () => {
    expect(canMutateSeason({ status: "CLOSED", isCurrent: true })).toBe(false);
  });
});

describe("assertCanMutateSeason", () => {
  it("ne lève pas d'erreur pour SETUP non-courante", () => {
    expect(() =>
      assertCanMutateSeason({ status: "SETUP", isCurrent: false })
    ).not.toThrow();
  });

  it("lève une erreur pour CLOSED", () => {
    expect(() =>
      assertCanMutateSeason({ status: "CLOSED", isCurrent: false })
    ).toThrow(/SETUP/);
  });

  it("lève une erreur pour ACTIVE", () => {
    expect(() =>
      assertCanMutateSeason({ status: "ACTIVE", isCurrent: false })
    ).toThrow(/SETUP/);
  });

  it("lève une erreur pour SETUP courante", () => {
    expect(() =>
      assertCanMutateSeason({ status: "SETUP", isCurrent: true })
    ).toThrow(/SETUP/);
  });
});
