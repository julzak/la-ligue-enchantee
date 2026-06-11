/**
 * Tests des gardes "joueur déjà attribué" (BRIEF-04, correctifs B0 et B0b).
 *
 * Valide la logique pure de findAlreadyWonByOther (B0) et findAlreadyWonBySelf
 * (B0b), appelées dans src/app/api/auction/route.ts.
 * Aucun mock Prisma nécessaire : la logique est extraite en module pur.
 *
 * Sanity-check inclus : B0 ne doit PAS bloquer les propres won (c'est B0b qui
 * les gère), et B0b ne doit PAS bloquer les won des autres.
 */

import { describe, it, expect } from "vitest";
import { findAlreadyWonByOther, findAlreadyWonBySelf } from "./auction-already-won";

const ME = 10;
const OTHER = 99;

describe("findAlreadyWonByOther — garde joueur déjà attribué", () => {
  it("sanity-check : retourne une liste non vide si la condition user_id !== userId était absente (régression)", () => {
    // Sans le filtre user_id, le joueur 42 gagné par MOI serait faussement bloqué.
    // Ce test garantit qu'on ne régresse pas vers ce comportement.
    const won = [{ player_id: 42, user_id: ME }];
    const bids = [{ playerId: 42 }];
    // La fonction DOIT retourner [] (pas de conflit : c'est ma propre mise gagnée)
    expect(findAlreadyWonByOther(bids, ME, won)).toHaveLength(0);
  });

  it("retourne vide si aucune mise ne concerne un joueur déjà attribué", () => {
    const won = [{ player_id: 1, user_id: OTHER }];
    const bids = [{ playerId: 2 }, { playerId: 3 }];
    expect(findAlreadyWonByOther(bids, ME, won)).toEqual([]);
  });

  it("retourne le playerId si le joueur a été attribué à un autre participant", () => {
    const won = [{ player_id: 7, user_id: OTHER }];
    const bids = [{ playerId: 7 }];
    expect(findAlreadyWonByOther(bids, ME, won)).toEqual([7]);
  });

  it("ne bloque pas si le joueur a été attribué à l'utilisateur lui-même (re-mise sur son propre joueur)", () => {
    const won = [{ player_id: 7, user_id: ME }];
    const bids = [{ playerId: 7 }];
    expect(findAlreadyWonByOther(bids, ME, won)).toEqual([]);
  });

  it("retourne plusieurs playerId si plusieurs joueurs sont en conflit", () => {
    const won = [
      { player_id: 10, user_id: OTHER },
      { player_id: 20, user_id: OTHER },
    ];
    const bids = [{ playerId: 10 }, { playerId: 20 }, { playerId: 30 }];
    const result = findAlreadyWonByOther(bids, ME, won);
    expect(result).toContain(10);
    expect(result).toContain(20);
    expect(result).not.toContain(30);
  });

  it("mixes : certains à moi, certains à un autre", () => {
    const OTHER2 = 200;
    const won = [
      { player_id: 1, user_id: ME },     // pas de conflit (c'est moi)
      { player_id: 2, user_id: OTHER },   // conflit
      { player_id: 3, user_id: OTHER2 },  // conflit
    ];
    const bids = [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }];
    const result = findAlreadyWonByOther(bids, ME, won);
    expect(result).not.toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
  });

  it("liste won vide → jamais de conflit", () => {
    const bids = [{ playerId: 1 }, { playerId: 2 }];
    expect(findAlreadyWonByOther(bids, ME, [])).toEqual([]);
  });

  it("liste bids vide → jamais de conflit", () => {
    const won = [{ player_id: 42, user_id: OTHER }];
    expect(findAlreadyWonByOther([], ME, won)).toEqual([]);
  });
});

// ── findAlreadyWonBySelf (garde B0b) ──────────────────────────────────────────

describe("findAlreadyWonBySelf — garde joueur déjà acquis par soi-même (règle 3.1)", () => {
  it("sanity-check B0/B0b : findAlreadyWonByOther ne bloque PAS un won propre, findAlreadyWonBySelf le détecte", () => {
    // Faille corrigée : avant B0b, un participant pouvait re-miser un joueur
    // qu'il avait lui-même gagné → double won + budget décompté deux fois.
    const won = [{ player_id: 42, user_id: ME }];
    const bids = [{ playerId: 42 }];
    // B0 ne doit PAS bloquer (c'est un won propre, pas un conflit "autre")
    expect(findAlreadyWonByOther(bids, ME, won)).toHaveLength(0);
    // B0b DOIT bloquer
    expect(findAlreadyWonBySelf(bids, ME, won)).toEqual([42]);
  });

  it("retourne vide si aucune mise ne concerne un joueur déjà acquis par soi-même", () => {
    const won = [{ player_id: 1, user_id: ME }];
    const bids = [{ playerId: 2 }, { playerId: 3 }];
    expect(findAlreadyWonBySelf(bids, ME, won)).toEqual([]);
  });

  it("retourne le playerId si le joueur a déjà été attribué au participant lui-même", () => {
    const won = [{ player_id: 7, user_id: ME }];
    const bids = [{ playerId: 7 }];
    expect(findAlreadyWonBySelf(bids, ME, won)).toEqual([7]);
  });

  it("ne bloque PAS si le joueur a été attribué à un autre participant (c'est le rôle de B0)", () => {
    const won = [{ player_id: 7, user_id: OTHER }];
    const bids = [{ playerId: 7 }];
    expect(findAlreadyWonBySelf(bids, ME, won)).toEqual([]);
  });

  it("retourne plusieurs playerId si plusieurs joueurs propres sont re-misés", () => {
    const won = [
      { player_id: 10, user_id: ME },
      { player_id: 20, user_id: ME },
      { player_id: 30, user_id: OTHER }, // won par un autre → pas B0b
    ];
    const bids = [{ playerId: 10 }, { playerId: 20 }, { playerId: 30 }];
    const result = findAlreadyWonBySelf(bids, ME, won);
    expect(result).toContain(10);
    expect(result).toContain(20);
    expect(result).not.toContain(30);
  });

  it("mixes : certains propres, certains d'un autre, certains jamais won", () => {
    const OTHER2 = 200;
    const won = [
      { player_id: 1, user_id: ME },     // propre → B0b
      { player_id: 2, user_id: OTHER },   // autre → B0 uniquement
      { player_id: 3, user_id: OTHER2 },  // autre → B0 uniquement
    ];
    const bids = [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }, { playerId: 4 }];
    const result = findAlreadyWonBySelf(bids, ME, won);
    expect(result).toContain(1);
    expect(result).not.toContain(2);
    expect(result).not.toContain(3);
    expect(result).not.toContain(4);
  });

  it("liste won vide → jamais de conflit", () => {
    const bids = [{ playerId: 1 }, { playerId: 2 }];
    expect(findAlreadyWonBySelf(bids, ME, [])).toEqual([]);
  });

  it("liste bids vide → jamais de conflit", () => {
    const won = [{ player_id: 42, user_id: ME }];
    expect(findAlreadyWonBySelf([], ME, won)).toEqual([]);
  });
});
