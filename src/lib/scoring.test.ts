import { describe, it, expect } from "vitest";
import { calculatePlayerPoints, calculateLineupScore, calculateWinterBudgets } from "./scoring";
import type { Performance } from "./types";

function makePerf(overrides: Partial<Performance> = {}): Performance {
  return {
    playerId: "test",
    matchday: 1,
    minutesPlayed: 90,
    rating: 6.0,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    redCard: false,
    penaltySaved: 0,
    penaltyMissed: 0,
    ...overrides,
  };
}

describe("calculatePlayerPoints", () => {
  it("base case: note standard", () => {
    const result = calculatePlayerPoints(makePerf({ rating: 6.5 }), "MID");
    expect(result.base).toBe(6.5);
    expect(result.total).toBe(6.5);
  });

  it("joueur non note (< 45 min) -> forfait 2 pts", () => {
    const result = calculatePlayerPoints(makePerf({ rating: null, minutesPlayed: 30 }), "DEF");
    expect(result.base).toBe(2);
    expect(result.total).toBe(2);
  });

  it("joueur non note (>= 45 min) -> forfait 2 pts", () => {
    const result = calculatePlayerPoints(makePerf({ rating: null, minutesPlayed: 60 }), "DEF");
    expect(result.base).toBe(2);
    expect(result.total).toBe(2);
  });

  it("carton rouge -> note remplacee par 0", () => {
    const result = calculatePlayerPoints(makePerf({ rating: 4.0, redCard: true }), "MID");
    expect(result.base).toBe(0);
    expect(result.redCardApplied).toBe(true);
    expect(result.total).toBe(0);
  });

  it("carton rouge avec but -> note 0, prime conservee", () => {
    const result = calculatePlayerPoints(
      makePerf({ rating: 4.0, redCard: true, goals: 1 }),
      "ATT"
    );
    expect(result.base).toBe(0);
    expect(result.goalBonus).toBe(2);
    expect(result.total).toBe(2); // 0 + 2
  });

  it("but par MID/ATT -> +2 pts", () => {
    const result = calculatePlayerPoints(makePerf({ goals: 2 }), "ATT");
    expect(result.goalBonus).toBe(4);
    expect(result.total).toBe(10); // 6 + 4
  });

  it("but par DEF -> +4 pts", () => {
    const result = calculatePlayerPoints(makePerf({ goals: 1, rating: 7.0 }), "DEF");
    expect(result.goalBonus).toBe(4);
    expect(result.total).toBe(11); // 7 + 4
  });

  it("but par GK -> +10 pts", () => {
    const result = calculatePlayerPoints(makePerf({ goals: 1, rating: 5.0 }), "GK");
    expect(result.goalBonus).toBe(10);
    expect(result.total).toBe(15); // 5 + 10
  });

  it("passe decisive -> +1 pt", () => {
    const result = calculatePlayerPoints(makePerf({ assists: 2, rating: 7.0 }), "MID");
    expect(result.assistBonus).toBe(2);
    expect(result.total).toBe(9); // 7 + 2
  });

  it("penalty arrete par GK -> +2 pts", () => {
    const result = calculatePlayerPoints(makePerf({ penaltySaved: 1, rating: 7.5 }), "GK");
    expect(result.penaltySavedBonus).toBe(2);
    expect(result.total).toBe(9.5); // 7.5 + 2
  });

  it("CSC -> -2 pts", () => {
    const result = calculatePlayerPoints(makePerf({ ownGoals: 1, rating: 5.5 }), "DEF");
    expect(result.ownGoalMalus).toBe(-2);
    expect(result.total).toBe(3.5); // 5.5 - 2
  });

  it("tapis vert sans feuille de match - equipe gagnante -> 5 pts", () => {
    const result = calculatePlayerPoints(
      makePerf({
        rating: null,
        tapisVert: { withTeamSheet: false, isWinningSide: true, isStarter: false },
      }),
      "MID"
    );
    expect(result.total).toBe(5);
  });

  it("tapis vert sans feuille de match - equipe perdante -> 4 pts", () => {
    const result = calculatePlayerPoints(
      makePerf({
        rating: null,
        tapisVert: { withTeamSheet: false, isWinningSide: false, isStarter: false },
      }),
      "MID"
    );
    expect(result.total).toBe(4);
  });

  it("tapis vert avec feuille - titulaire gagnant -> 5 pts", () => {
    const result = calculatePlayerPoints(
      makePerf({
        rating: null,
        tapisVert: { withTeamSheet: true, isWinningSide: true, isStarter: true },
      }),
      "DEF"
    );
    expect(result.total).toBe(5);
  });

  it("tapis vert avec feuille - titulaire perdant -> 4 pts", () => {
    const result = calculatePlayerPoints(
      makePerf({
        rating: null,
        tapisVert: { withTeamSheet: true, isWinningSide: false, isStarter: true },
      }),
      "DEF"
    );
    expect(result.total).toBe(4);
  });

  it("tapis vert avec feuille - remplacant -> 2 pts (quelle que soit l'equipe)", () => {
    const winner = calculatePlayerPoints(
      makePerf({
        rating: null,
        tapisVert: { withTeamSheet: true, isWinningSide: true, isStarter: false },
      }),
      "ATT"
    );
    const loser = calculatePlayerPoints(
      makePerf({
        rating: null,
        tapisVert: { withTeamSheet: true, isWinningSide: false, isStarter: false },
      }),
      "ATT"
    );
    expect(winner.total).toBe(2);
    expect(loser.total).toBe(2);
  });

  it("combo: but + passe + CSC", () => {
    const result = calculatePlayerPoints(
      makePerf({ rating: 7.0, goals: 1, assists: 1, ownGoals: 1 }),
      "MID"
    );
    // 7 + 2 (but MID) + 1 (passe) - 2 (CSC) = 8
    expect(result.total).toBe(8);
  });
});

describe("calculateLineupScore", () => {
  it("sums 11 starter scores", () => {
    const starters = ["p1", "p2", "p3"];
    const perfs: Performance[] = [
      makePerf({ playerId: "p1", rating: 6.0 }),
      makePerf({ playerId: "p2", rating: 7.0 }),
      makePerf({ playerId: "p3", rating: 5.0 }),
    ];
    const result = calculateLineupScore(starters, perfs, () => "MID");
    expect(result.total).toBe(18); // 6 + 7 + 5
    expect(result.playerScores).toHaveLength(3);
  });

  it("missing performance -> forfait 2 pts", () => {
    const starters = ["p1", "p_missing"];
    const perfs: Performance[] = [makePerf({ playerId: "p1", rating: 6.0 })];
    const result = calculateLineupScore(starters, perfs, () => "MID");
    expect(result.total).toBe(8); // 6 + 2
  });
});

describe("calculateWinterBudgets", () => {
  it("gives 10 to 1st, +2 per rank", () => {
    const standings = [
      { rank: 1, participantId: "a" },
      { rank: 2, participantId: "b" },
      { rank: 3, participantId: "c" },
    ];
    const budgets = calculateWinterBudgets(standings);
    expect(budgets[0].budget).toBe(10);
    expect(budgets[1].budget).toBe(12);
    expect(budgets[2].budget).toBe(14);
  });

  it("gives 48 to 20th", () => {
    const standings = [{ rank: 20, participantId: "last" }];
    const budgets = calculateWinterBudgets(standings);
    expect(budgets[0].budget).toBe(48);
  });
});
