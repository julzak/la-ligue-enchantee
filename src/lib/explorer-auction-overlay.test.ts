/**
 * Tests de l'overlay enchères pour l'explorateur.
 *
 * Contexte (remontée Pierre 2026-08-10) : pendant la phase d'enchères, TEAM
 * est vide (elle n'est écrite qu'à la clôture de phase, statut 'resolved').
 * L'explorateur affichait donc tous les joueurs « Libre » alors que des
 * mises won existaient en AUCTION_BID. L'overlay corrige cet affichage.
 *
 * Logique pure uniquement, pas de base : les fonctions testées sont celles
 * consommées par getClubsWithStats (src/lib/db.ts).
 */

import { describe, it, expect } from "vitest";
import {
  isAuctionPhaseActive,
  overlayAuctionOwners,
} from "./explorer-auction-overlay";

describe("explorateur pendant la phase d'enchères : joueurs won affichés pris", () => {
  it("sanity-check : sans overlay, la donnée buggée d'origine donne 'Libre' partout", () => {
    // État prod du 2026-08-10 (réduit) : TEAM vide, mises won en AUCTION_BID.
    const teamOwners = new Map<number, string>();
    const won = [
      { playerId: 101, ownerName: "Pierre" },
      { playerId: 102, ownerName: "Laurent" },
    ];
    // Le bug : l'explorateur ne lisait que TEAM.
    expect(teamOwners.get(101)).toBeUndefined();
    expect(teamOwners.get(102)).toBeUndefined();
    // Le fix : l'overlay rend les deux joueurs pris.
    const merged = overlayAuctionOwners(teamOwners, won);
    expect(merged.get(101)).toBe("Pierre");
    expect(merged.get(102)).toBe("Laurent");
    expect(merged.size).toBe(2);
  });

  it("un joueur sans mise won reste libre", () => {
    const merged = overlayAuctionOwners(new Map(), [
      { playerId: 101, ownerName: "Pierre" },
    ]);
    expect(merged.has(999)).toBe(false);
  });

  it("TEAM garde la priorité sur la mise won en cas de recouvrement", () => {
    // Transition clôture : si TEAM est déjà écrite (retraits, complétions
    // d'office), c'est elle qui fait foi, pas la mise won brute.
    const teamOwners = new Map<number, string>([[101, "Kazu"]]);
    const merged = overlayAuctionOwners(teamOwners, [
      { playerId: 101, ownerName: "Pierre" },
    ]);
    expect(merged.get(101)).toBe("Kazu");
  });

  it("l'entrée n'est pas mutée", () => {
    const teamOwners = new Map<number, string>();
    overlayAuctionOwners(teamOwners, [{ playerId: 101, ownerName: "Pierre" }]);
    expect(teamOwners.size).toBe(0);
  });
});

describe("détection de la phase active (cycle open → closed → tallied → resolved)", () => {
  it("phase active pour open, closed et tallied", () => {
    expect(isAuctionPhaseActive("open")).toBe(true);
    expect(isAuctionPhaseActive("closed")).toBe(true);
    expect(isAuctionPhaseActive("tallied")).toBe(true);
  });

  it("phase inactive après clôture (resolved) : TEAM seule source de vérité", () => {
    expect(isAuctionPhaseActive("resolved")).toBe(false);
  });

  it("pas d'enchère pour la ligue (saisons archivées) : pas d'overlay", () => {
    expect(isAuctionPhaseActive(null)).toBe(false);
    expect(isAuctionPhaseActive(undefined)).toBe(false);
  });
});
