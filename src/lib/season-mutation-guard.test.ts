import { describe, it, expect } from "vitest";
import {
  canMutateSeason,
  assertCanMutateSeason,
  isLeagueAuctionable,
} from "./season-mutation-guard";

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

describe("isLeagueAuctionable", () => {
  // Régression du 2026-08-01 : pendant la préparation de la saison 2026-2027,
  // la Console des enchères listait les 3 divisions de la saison clôturée
  // 2026 EN PLUS des 3 nouvelles (signalé par Thomas : "ligues en double").
  // Ouvrir un tour sur l'une d'elles aurait créé une enchère orpheline.
  it("refuse une ligue dont la saison est clôturée", () => {
    expect(isLeagueAuctionable("CLOSED")).toBe(false);
  });

  it("autorise les divisions de la saison en préparation ou en cours", () => {
    expect(isLeagueAuctionable("SETUP")).toBe(true);
    expect(isLeagueAuctionable("AUCTION")).toBe(true);
    expect(isLeagueAuctionable("ACTIVE")).toBe(true);
    expect(isLeagueAuctionable("WINTER")).toBe(true);
  });

  it("autorise une ligue legacy sans saison de rattachement", () => {
    expect(isLeagueAuctionable(null)).toBe(true);
  });

  // Sanity-check : prouve que le test détecterait la régression qu'il garde.
  // Le comportement buggé (tout accepter) ferait échouer le premier cas.
  it("sanity-check : un filtre permissif serait détecté", () => {
    const buggy = (s: string | null) => s !== "INEXISTANT";
    expect(buggy("CLOSED")).not.toBe(isLeagueAuctionable("CLOSED"));
  });
});
