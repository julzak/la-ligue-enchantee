/**
 * Tests de la logique d'appartenance à une ligue (correctif B1 — fuite inter-ligues).
 *
 * Contexte : /api/auction/results acceptait n'importe quel leagueId sans vérifier
 * que l'utilisateur authentifié appartient à la ligue demandée.
 * Un user pouvait lire les résultats de n'importe quelle ligue.
 *
 * Correctif : SELECT COUNT(*) sur LEAGUE_USER avant toute requête métier.
 * Si count = 0 → 403. Cette logique pure est testée ici sans mock DB.
 */

import { describe, it, expect } from "vitest";
import { isMember } from "./auction-membership";

describe("isMember — contrôle d'appartenance à une ligue (B1)", () => {
  // Sanity-check : sans ce contrôle, la régression serait invisible
  it("sanity-check : count=0 renvoie false (user NON membre — doit déclencher 403)", () => {
    expect(isMember(0)).toBe(false);
  });

  it("count=1 → user membre, accès autorisé", () => {
    expect(isMember(1)).toBe(true);
  });

  it("count > 1 → toujours autorisé (cohérence, ne devrait pas arriver mais défensif)", () => {
    expect(isMember(2)).toBe(true);
  });

  it("count=0 → accès refusé (fuite inter-ligues bloquée)", () => {
    expect(isMember(0)).toBe(false);
  });
});
