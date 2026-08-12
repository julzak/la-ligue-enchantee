import { describe, it, expect } from "vitest";
import { parisUtcOffsetHours, parisWallTimeToUtc } from "./paris-time";

describe("paris-time", () => {
  describe("parisUtcOffsetHours : ete (CEST) = +2, hiver (CET) = +1", () => {
    it("ete : +2 en aout (ouverture de saison)", () => {
      expect(parisUtcOffsetHours(new Date("2026-08-15T12:00:00Z"))).toBe(2);
    });
    it("ete : +2 en septembre/octobre avant bascule", () => {
      expect(parisUtcOffsetHours(new Date("2026-10-20T12:00:00Z"))).toBe(2);
    });
    it("hiver : +1 en novembre", () => {
      expect(parisUtcOffsetHours(new Date("2026-11-15T12:00:00Z"))).toBe(1);
    });
    it("hiver : +1 en janvier et fevrier (coeur de saison)", () => {
      expect(parisUtcOffsetHours(new Date("2027-01-15T12:00:00Z"))).toBe(1);
      expect(parisUtcOffsetHours(new Date("2027-02-15T12:00:00Z"))).toBe(1);
    });
    it("ete : +2 en avril/mai (fin de saison)", () => {
      expect(parisUtcOffsetHours(new Date("2027-05-01T12:00:00Z"))).toBe(2);
    });

    // Sanity-check : prouve que le test detecterait un offset code en dur a +2.
    // Un code qui renverrait toujours 2 (le bug) echouerait sur ce cas hiver.
    it("SANITY : un offset fige a +2 serait faux en hiver", () => {
      const hiver = parisUtcOffsetHours(new Date("2027-01-15T12:00:00Z"));
      expect(hiver).not.toBe(2);
    });
  });

  describe("parisWallTimeToUtc : 15h Paris -> bon instant UTC selon la saison", () => {
    it("ete : 15h Paris = 13h UTC", () => {
      expect(parisWallTimeToUtc("2026-08-15", 15).toISOString()).toBe("2026-08-15T13:00:00.000Z");
    });
    it("hiver : 15h Paris = 14h UTC (et NON 13h : c'est le coeur du bug corrige)", () => {
      expect(parisWallTimeToUtc("2027-01-15", 15).toISOString()).toBe("2027-01-15T14:00:00.000Z");
    });
    it("gere les minutes", () => {
      expect(parisWallTimeToUtc("2026-08-15", 20, 45).toISOString()).toBe("2026-08-15T18:45:00.000Z");
    });

    // Sanity-check : avec l'ancien code (Paris = UTC+2 en dur), 15h Paris en
    // hiver donnait 13h UTC. Le test ci-dessous prouve qu'on ne regenere pas ce bug.
    it("SANITY : l'ancien calcul en dur (15h - 2 = 13h UTC) est bien rejete en hiver", () => {
      const utc = parisWallTimeToUtc("2027-01-15", 15).toISOString();
      expect(utc).not.toBe("2027-01-15T13:00:00.000Z");
    });
  });
});
