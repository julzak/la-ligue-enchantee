import { describe, it, expect } from "vitest";
import { findResumableSeason, resolveStepFromStatus } from "./season-resume";

const make = (id: number, status: string) => ({ id, label: `${id}`, status, isCurrent: false });

describe("findResumableSeason", () => {
  it("retourne null si la liste est vide", () => {
    expect(findResumableSeason([])).toBeNull();
  });

  it("retourne null si toutes les saisons sont CLOSED", () => {
    expect(findResumableSeason([make(1, "CLOSED"), make(2, "CLOSED")])).toBeNull();
  });

  it("retourne la saison non-CLOSED la plus récente (id max)", () => {
    const seasons = [make(1, "CLOSED"), make(3, "SETUP"), make(2, "AUCTION")];
    const result = findResumableSeason(seasons);
    expect(result?.id).toBe(3);
  });

  it("retourne la seule saison non-CLOSED même si id < CLOSED", () => {
    const seasons = [make(5, "CLOSED"), make(2, "SETUP")];
    expect(findResumableSeason(seasons)?.id).toBe(2);
  });

  it("CLOSED ne masque pas une saison AUCTION plus récente", () => {
    const seasons = [make(10, "AUCTION"), make(9, "CLOSED"), make(8, "CLOSED")];
    expect(findResumableSeason(seasons)?.id).toBe(10);
  });
});

describe("resolveStepFromStatus", () => {
  it("SETUP → étape 2", () => {
    expect(resolveStepFromStatus("SETUP")).toBe(2);
  });

  it("AUCTION → étape 5", () => {
    expect(resolveStepFromStatus("AUCTION")).toBe(5);
  });

  it("ACTIVE → étape 2 par défaut (cas de secours)", () => {
    expect(resolveStepFromStatus("ACTIVE")).toBe(2);
  });

  it("valeur inconnue → étape 2 par défaut", () => {
    expect(resolveStepFromStatus("UNKNOWN")).toBe(2);
  });
});
