/**
 * Tests de la règle "max 1 gardien dans la mise (acquis compris)".
 *
 * Décision Julien 2026-06-11 (docs/regles-encheres.md §7).
 * Sanity-check inclus : prouve que le test peut détecter une régression
 * si la condition totalGoalkeepers > 1 était absente.
 */

import { describe, it, expect } from "vitest";
import { checkGoalkeeperLimit, countGoalkeepers } from "./auction-goalkeeper-limit";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GK = { position: "Gardien" };
const GK_ALT = { position: "gardien" }; // insensible à la casse
const DEF = { position: "Défenseur" };
const MID = { position: "Milieu" };
const ATT = { position: "Attaquant" };

// ── countGoalkeepers ──────────────────────────────────────────────────────────

describe("countGoalkeepers", () => {
  it("retourne 0 pour une liste vide", () => {
    expect(countGoalkeepers([])).toBe(0);
  });

  it("retourne 0 si aucun gardien dans la liste", () => {
    expect(countGoalkeepers([DEF, MID, ATT])).toBe(0);
  });

  it("retourne 1 si exactement un gardien", () => {
    expect(countGoalkeepers([GK, DEF, MID])).toBe(1);
  });

  it("est insensible à la casse de la position", () => {
    expect(countGoalkeepers([GK_ALT])).toBe(1);
  });

  it("retourne 2 si deux gardiens dans la liste", () => {
    expect(countGoalkeepers([GK, GK_ALT, DEF])).toBe(2);
  });
});

// ── checkGoalkeeperLimit ──────────────────────────────────────────────────────

describe("checkGoalkeeperLimit", () => {
  it("sanity-check : si la condition > 1 était absente, 1 GK serait faussement rejeté (régression)", () => {
    // Ce test garantit que 1 GK est ACCEPTÉ (rejected: false).
    // Sans le seuil > 1, même 1 gardien serait bloqué.
    const { rejected } = checkGoalkeeperLimit([], [GK]);
    expect(rejected).toBe(false);
  });

  it("0 GK en draft + 0 GK acquis → OK (pas de gardien, c'est un avertissement, pas un rejet)", () => {
    const result = checkGoalkeeperLimit([DEF, MID], [ATT]);
    expect(result.rejected).toBe(false);
    expect(result.totalGoalkeepers).toBe(0);
  });

  it("1 GK en draft + 0 GK acquis → OK", () => {
    const result = checkGoalkeeperLimit([DEF], [GK, ATT]);
    expect(result.rejected).toBe(false);
    expect(result.totalGoalkeepers).toBe(1);
  });

  it("0 GK en draft + 1 GK acquis → OK (gardien acquis reporté, aucun nouveau gardien misé)", () => {
    const result = checkGoalkeeperLimit([GK, DEF], [MID, ATT]);
    expect(result.rejected).toBe(false);
    expect(result.totalGoalkeepers).toBe(1);
  });

  it("2 GK en draft + 0 GK acquis → REJET", () => {
    const result = checkGoalkeeperLimit([], [GK, GK_ALT, DEF]);
    expect(result.rejected).toBe(true);
    expect(result.totalGoalkeepers).toBe(2);
  });

  it("1 GK acquis + 1 GK en draft → REJET (acquis compris dans le comptage)", () => {
    const result = checkGoalkeeperLimit([GK], [GK_ALT, DEF]);
    expect(result.rejected).toBe(true);
    expect(result.totalGoalkeepers).toBe(2);
  });

  it("1 GK acquis + 0 GK en draft → OK (le gardien acquis est reporté automatiquement)", () => {
    const result = checkGoalkeeperLimit([GK, DEF, MID, ATT], []);
    expect(result.rejected).toBe(false);
    expect(result.totalGoalkeepers).toBe(1);
  });

  it("0 GK total → rejected false (cas 0 GK = avertissement dépouillement, pas rejet)", () => {
    const result = checkGoalkeeperLimit([DEF, MID], [ATT]);
    expect(result.rejected).toBe(false);
    expect(result.totalGoalkeepers).toBe(0);
  });
});
