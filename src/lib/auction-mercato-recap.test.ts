import { describe, it, expect } from "vitest";
import { buildMercatoRecap, type MercatoWonBid } from "./auction-mercato-recap";

const participants = [
  { userId: 3, userName: "Charles" },
  { userId: 1, userName: "Alice" },
  { userId: 2, userName: "Bruno" },
];

function bid(partial: Partial<MercatoWonBid> & Pick<MercatoWonBid, "userId" | "round" | "amount">): MercatoWonBid {
  return {
    playerId: 100 + partial.amount,
    playerName: `Joueur${partial.amount}`,
    position: "Milieu",
    clubName: "Marseille",
    ...partial,
  } as MercatoWonBid;
}

describe("buildMercatoRecap : agrégation par participant", () => {
  it("calcule totalSpent et playersWon par participant, et les totaux globaux", () => {
    const recap = buildMercatoRecap(participants, [
      bid({ userId: 1, round: 1, amount: 20 }),
      bid({ userId: 1, round: 2, amount: 5 }),
      bid({ userId: 2, round: 1, amount: 12 }),
    ]);
    const alice = recap.participants.find((p) => p.userId === 1)!;
    expect(alice.totalSpent).toBe(25);
    expect(alice.playersWon).toBe(2);
    expect(recap.totals).toEqual({ players: 3, points: 37 });
  });

  it("sanity-check : un cumul bogué qui ignorerait les tours > 1 serait détecté", () => {
    // Régression gardée : un budget calculé sur le seul tour courant (bug type
    // "ne tracer que le tour sélectionné") donnerait totalSpent = 20, pas 25.
    const recap = buildMercatoRecap(participants, [
      bid({ userId: 1, round: 1, amount: 20 }),
      bid({ userId: 1, round: 2, amount: 5 }),
    ]);
    expect(recap.participants.find((p) => p.userId === 1)!.totalSpent).not.toBe(20);
  });

  it("inclut les membres sans acquisition (listes vides, filtrables)", () => {
    const recap = buildMercatoRecap(participants, [bid({ userId: 1, round: 1, amount: 10 })]);
    const bruno = recap.participants.find((p) => p.userId === 2)!;
    expect(bruno.playersWon).toBe(0);
    expect(bruno.acquisitions).toEqual([]);
    expect(recap.participants).toHaveLength(3);
  });

  it("trie les participants par nom et les acquisitions par tour puis montant décroissant", () => {
    const recap = buildMercatoRecap(participants, [
      bid({ userId: 1, round: 2, amount: 3 }),
      bid({ userId: 1, round: 1, amount: 8 }),
      bid({ userId: 1, round: 1, amount: 15 }),
    ]);
    expect(recap.participants.map((p) => p.userName)).toEqual(["Alice", "Bruno", "Charles"]);
    expect(recap.participants[0].acquisitions.map((a) => [a.round, a.amount])).toEqual([
      [1, 15],
      [1, 8],
      [2, 3],
    ]);
  });

  it("liste les tours distincts triés croissant", () => {
    const recap = buildMercatoRecap(participants, [
      bid({ userId: 2, round: 3, amount: 1 }),
      bid({ userId: 1, round: 1, amount: 2 }),
      bid({ userId: 3, round: 3, amount: 4 }),
    ]);
    expect(recap.rounds).toEqual([1, 3]);
  });
});
