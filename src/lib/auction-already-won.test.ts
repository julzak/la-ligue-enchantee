/**
 * Tests de la garde "joueur déjà attribué" (BRIEF-04, correctif m2).
 *
 * Valide la logique pure de findAlreadyWonByOther, qui est appelée dans
 * src/app/api/auction/route.ts (garde serveur B0).
 * Aucun mock Prisma nécessaire : la logique est extraite en module pur.
 *
 * Sanity-check inclus : sans la condition `user_id !== userId`, le cas
 * "joueur déjà gagné par soi-même" déclencherait faussement un blocage.
 */

import { describe, it, expect } from "vitest";
import { findAlreadyWonByOther } from "./auction-already-won";

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
