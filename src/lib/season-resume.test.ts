import { describe, it, expect } from "vitest";
import { findResumableSeason, resolveStepFromStatus } from "./season-resume";

const make = (id: number, status: string, isCurrent = false) => ({
  id,
  label: `${id}`,
  status,
  isCurrent,
});

describe("findResumableSeason", () => {
  it("retourne null si la liste est vide", () => {
    expect(findResumableSeason([])).toBeNull();
  });

  it("retourne null si toutes les saisons sont CLOSED", () => {
    expect(findResumableSeason([make(1, "CLOSED"), make(2, "CLOSED")])).toBeNull();
  });

  it("retourne la saison SETUP la plus récente (id max)", () => {
    const seasons = [make(1, "CLOSED"), make(3, "SETUP"), make(2, "AUCTION")];
    const result = findResumableSeason(seasons);
    expect(result?.id).toBe(3);
  });

  it("retourne la seule saison SETUP même si id < CLOSED", () => {
    const seasons = [make(5, "CLOSED"), make(2, "SETUP")];
    expect(findResumableSeason(seasons)?.id).toBe(2);
  });

  it("CLOSED ne masque pas une saison AUCTION plus récente", () => {
    const seasons = [make(10, "AUCTION"), make(9, "CLOSED"), make(8, "CLOSED")];
    expect(findResumableSeason(seasons)?.id).toBe(10);
  });

  // --- Cas de régression : saison ACTIVE/WINTER ne doit jamais être reprenable ---

  it("[REGRESSION] saison ACTIVE isCurrent=true + SETUP ancienne → reprend la SETUP, pas la ACTIVE", () => {
    // Avant le fix : filter(s => s.status !== "CLOSED") renvoyait la saison ACTIVE (id=10)
    // Après le fix : seules SETUP/AUCTION non-isCurrent sont candidates
    const seasons = [make(10, "ACTIVE", true), make(5, "SETUP", false)];
    const result = findResumableSeason(seasons);
    expect(result?.id).toBe(5);
    expect(result?.status).toBe("SETUP");
  });

  it("[REGRESSION] seule saison non-CLOSED est ACTIVE/isCurrent → retourne null (pas de reprise)", () => {
    // Avant le fix : renvoyait la saison ACTIVE → stepper sautait à l'étape 2 en pleine saison live
    const seasons = [make(1, "CLOSED"), make(2, "CLOSED"), make(10, "ACTIVE", true)];
    expect(findResumableSeason(seasons)).toBeNull();
  });

  it("[REGRESSION] saison WINTER non-isCurrent → retourne null (WINTER n'est pas reprenable)", () => {
    const seasons = [make(1, "CLOSED"), make(5, "WINTER", false)];
    expect(findResumableSeason(seasons)).toBeNull();
  });

  it("[REGRESSION] saison ACTIVE isCurrent=false → retourne null (ACTIVE n'est pas reprenable même sans isCurrent)", () => {
    // Par sécurité : ACTIVE est exclu par le filtre de statuts, pas seulement par isCurrent
    const seasons = [make(1, "CLOSED"), make(5, "ACTIVE", false)];
    expect(findResumableSeason(seasons)).toBeNull();
  });

  it("saison SETUP isCurrent=true → exclue (isCurrent prime sur le statut)", () => {
    // Cas théorique mais à couvrir pour la cohérence
    const seasons = [make(10, "SETUP", true), make(5, "SETUP", false)];
    const result = findResumableSeason(seasons);
    expect(result?.id).toBe(5);
  });
});

describe("resolveStepFromStatus", () => {
  it("SETUP → étape 2", () => {
    expect(resolveStepFromStatus("SETUP")).toBe(2);
  });

  it("AUCTION → étape 5", () => {
    expect(resolveStepFromStatus("AUCTION")).toBe(5);
  });

  it("[REGRESSION] ACTIVE → null (plus de défaut à 2)", () => {
    // Avant le fix : renvoyait 2, ce qui forçait le stepper à l'import en pleine saison live
    expect(resolveStepFromStatus("ACTIVE")).toBeNull();
  });

  it("[REGRESSION] WINTER → null", () => {
    expect(resolveStepFromStatus("WINTER")).toBeNull();
  });

  it("CLOSED → null", () => {
    expect(resolveStepFromStatus("CLOSED")).toBeNull();
  });

  it("valeur inconnue → null (plus de défaut à 2)", () => {
    // Sanity-check : prouve que le défaut historique step=2 est supprimé
    expect(resolveStepFromStatus("UNKNOWN")).toBeNull();
  });
});
