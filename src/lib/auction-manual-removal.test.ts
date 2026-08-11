// Tests du retrait manuel d'une acquisition par un admin (planManualRemoval).
// Contrat de la route POST /api/admin/auction action=remove-acquisition :
//   bid inexistant / déjà removed / autre enchère / phase close → 4xx sans écriture ;
//   cas nominal → plan de retrait (removal row + statut 'removed').

import { describe, it, expect } from "vitest";
import { planManualRemoval, type ManualRemovalBid } from "./auction-manual-removal";

const AUCTION = { id: 12, status: "tallied" };

// Réplique du cas réel : bid 2667 (le Troyen de Blek), retiré en SQL le 2026-08-11.
function wonBid(overrides: Partial<ManualRemovalBid> = {}): ManualRemovalBid {
  return {
    id: 2667,
    auctionId: 12,
    round: 1,
    userId: 42,
    playerId: 777,
    amount: 9,
    status: "won",
    ...overrides,
  };
}

describe("retrait manuel : gardes de la route", () => {
  it("bid inexistant → 404", () => {
    const plan = planManualRemoval({ bid: null, auction: AUCTION, adminName: "Julien" });
    expect(plan.error).toBe("Mise introuvable");
    if (plan.error) expect(plan.httpStatus).toBe(404);
  });

  it("bid d'une autre enchère (autre ligue) → 409, aucune écriture", () => {
    const plan = planManualRemoval({
      bid: wonBid({ auctionId: 99 }),
      auction: AUCTION,
      adminName: "Julien",
    });
    expect(plan.error).toMatch(/ligue sélectionnée/);
    if (plan.error) expect(plan.httpStatus).toBe(409);
  });

  it("bid déjà removed → 409 (idempotence du double-clic)", () => {
    const plan = planManualRemoval({
      bid: wonBid({ status: "removed" }),
      auction: AUCTION,
      adminName: "Julien",
    });
    expect(plan.error).toMatch(/déjà été retirée/);
    if (plan.error) expect(plan.httpStatus).toBe(409);
  });

  it("bid non gagné (pending/lost/tie) → 409", () => {
    for (const status of ["pending", "lost", "tie"]) {
      const plan = planManualRemoval({
        bid: wonBid({ status }),
        auction: AUCTION,
        adminName: "Julien",
      });
      expect(plan.error, `statut ${status}`).toMatch(/n'est pas une acquisition/);
    }
  });

  it("phase close (resolved) → 409 : les effectifs TEAM sont déjà écrits", () => {
    const plan = planManualRemoval({
      bid: wonBid(),
      auction: { id: 12, status: "resolved" },
      adminName: "Julien",
    });
    expect(plan.error).toMatch(/phase est close/);
    if (plan.error) expect(plan.httpStatus).toBe(409);
  });
});

describe("retrait manuel : cas nominal", () => {
  it("bid won → plan de retrait fidèle au geste SQL du bid 2667", () => {
    const plan = planManualRemoval({ bid: wonBid(), auction: AUCTION, adminName: "Julien" });
    expect(plan.error).toBeUndefined();
    // Discrimination de l'union par `=== undefined` (même motif que la route
    // consommatrice) : `!plan.error` ne narrow pas, `error` étant un string
    // (une chaîne vide serait falsy sans écarter la branche erreur).
    if (plan.error === undefined) {
      expect(plan.removal).toEqual({
        auctionId: 12,
        round: 1,
        userId: 42,
        playerId: 777,
        amount: 9,
        reason: "Retrait manuel par Julien",
      });
    }
  });

  it("le reason inclut TOUJOURS le pseudo de l'admin de la session (traçabilité)", () => {
    const plan = planManualRemoval({ bid: wonBid(), auction: AUCTION, adminName: "Laurent" });
    if (plan.error === undefined) expect(plan.removal.reason).toBe("Retrait manuel par Laurent");
    // Repli si le pseudo de session est vide (jamais le cas en pratique) :
    // on ne stocke pas un reason sans auteur lisible.
    const fallback = planManualRemoval({ bid: wonBid(), auction: AUCTION, adminName: "  " });
    if (fallback.error === undefined) expect(fallback.removal.reason).toBe("Retrait manuel par admin");
  });

  it("sanity-check : le détecteur distingue bien won des autres statuts", () => {
    // Prouve que les tests de garde ci-dessus détecteraient la régression
    // qu'ils gardent : le même bid passe avec 'won' et échoue avec 'removed'.
    const ok = planManualRemoval({ bid: wonBid({ status: "won" }), auction: AUCTION, adminName: "x" });
    const ko = planManualRemoval({ bid: wonBid({ status: "removed" }), auction: AUCTION, adminName: "x" });
    expect(ok.error).toBeUndefined();
    expect(ko.error).toBeDefined();
  });
});
