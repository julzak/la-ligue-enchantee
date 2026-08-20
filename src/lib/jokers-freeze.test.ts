import { describe, it, expect } from "vitest";
import { computeFreezePhase, FREEZE_NOTICE_DAYS } from "./jokers-freeze";

// Fenêtre de référence 2026-2027 (annonce Pierre) : 1er janvier -> 2 février 20h.
const START = new Date("2027-01-01T00:00:00");
const END = new Date("2027-02-02T20:00:00");

describe("gel des jokers : fenêtre du mercato d'hiver", () => {
  it("gelé pendant toute la fenêtre", () => {
    expect(computeFreezePhase(new Date("2027-01-15T12:00:00"), START, END)).toBe("active");
  });

  it("tolérance zéro au début : gelé pile à l'instant de début", () => {
    expect(computeFreezePhase(new Date(START), START, END)).toBe("active");
    expect(computeFreezePhase(new Date(START.getTime() - 1), START, END)).not.toBe("active");
  });

  it("tolérance zéro à la fin : rouvert pile à l'instant de fin (2 février 20h00:00)", () => {
    expect(computeFreezePhase(new Date(END), START, END)).toBe("none");
    expect(computeFreezePhase(new Date(END.getTime() - 1), START, END)).toBe("active");
  });

  it("bannière d'avertissement à partir de J-7, pas avant", () => {
    const j7 = new Date(START.getTime() - FREEZE_NOTICE_DAYS * 24 * 3600 * 1000);
    expect(computeFreezePhase(j7, START, END)).toBe("upcoming");
    expect(computeFreezePhase(new Date(j7.getTime() - 1), START, END)).toBe("none");
    expect(computeFreezePhase(new Date("2026-12-28T10:00:00"), START, END)).toBe("upcoming");
  });

  it("hors fenêtre et hors préavis : rien", () => {
    expect(computeFreezePhase(new Date("2026-11-01T00:00:00"), START, END)).toBe("none");
    expect(computeFreezePhase(new Date("2027-03-01T00:00:00"), START, END)).toBe("none");
  });

  it("config absente ou incohérente : jamais de gel", () => {
    expect(computeFreezePhase(new Date("2027-01-15T00:00:00"), null, null)).toBe("none");
    expect(computeFreezePhase(new Date("2027-01-15T00:00:00"), START, null)).toBe("none");
    expect(computeFreezePhase(new Date("2027-01-15T00:00:00"), null, END)).toBe("none");
    // end <= start : fenêtre invalide, on ne gèle pas sur une erreur de saisie
    expect(computeFreezePhase(new Date("2027-01-15T00:00:00"), END, START)).toBe("none");
  });

  // Sanity-check : prouve que ce test détecterait la régression qu'il garde.
  // Une implémentation naïve "now > start && now < end" (bornes exclusives des
  // deux côtés) laisserait passer un joker posé pile au début du gel, et une
  // "now <= end" garderait les jokers fermés à 20h00 pile le 2 février.
  it("sanity-check : les bornes distinguent bien l'implémentation stricte de la naïve", () => {
    const naiveExclusive = (now: Date) => now.getTime() > START.getTime() && now.getTime() < END.getTime();
    const naiveInclusiveEnd = (now: Date) => now.getTime() >= START.getTime() && now.getTime() <= END.getTime();
    // Au début pile : la naïve exclusive dit "pas gelé", la nôtre dit "gelé".
    expect(naiveExclusive(new Date(START))).toBe(false);
    expect(computeFreezePhase(new Date(START), START, END)).toBe("active");
    // À la fin pile : la naïve inclusive dit "gelé", la nôtre dit "rouvert".
    expect(naiveInclusiveEnd(new Date(END))).toBe(true);
    expect(computeFreezePhase(new Date(END), START, END)).toBe("none");
  });
});
