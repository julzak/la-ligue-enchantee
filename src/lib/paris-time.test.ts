import { describe, it, expect } from "vitest";
import { toParisDateTime, nextDay, seasonStartYear, parisWallTimeToUtc } from "./paris-time";

describe("toParisDateTime — utcDate football-data vers heure murale de Paris", () => {
  it("convertit un coup d'envoi d'été (UTC+2)", () => {
    // OM - Strasbourg, J1 2026-2027 : 18h45 UTC = 20h45 à Paris.
    expect(toParisDateTime("2026-08-21T18:45:00Z")).toEqual({ date: "2026-08-21", time: "20:45" });
  });

  it("convertit un coup d'envoi d'hiver (UTC+1)", () => {
    expect(toParisDateTime("2027-01-15T20:00:00Z")).toEqual({ date: "2027-01-15", time: "21:00" });
  });

  it("bascule de jour quand le match UTC est la veille au soir", () => {
    // SANITY-CHECK du piège : 22h05 Paris un samedi = 20h05 UTC le même jour,
    // mais 23h00 UTC = 01h00 Paris le LENDEMAIN. Stocker la date UTC brute
    // décalerait le match, l'édition L'Équipe et la deadline.
    expect(toParisDateTime("2026-08-22T23:00:00Z")).toEqual({ date: "2026-08-23", time: "01:00" });
  });

  it("rejette une date invalide", () => {
    expect(toParisDateTime("n/a")).toBeNull();
  });

  it("est l'inverse de parisWallTimeToUtc (helper deadlines existant)", () => {
    const utc = parisWallTimeToUtc("2026-08-21", 20, 45);
    expect(toParisDateTime(utc.toISOString())).toEqual({ date: "2026-08-21", time: "20:45" });
  });
});

describe("nextDay / seasonStartYear", () => {
  it("édition L'Équipe = lendemain, y compris sur fin de mois", () => {
    expect(nextDay("2026-08-31")).toBe("2026-09-01");
  });

  it("extrait l'année de début des deux formats de clé de saison", () => {
    expect(seasonStartYear("2026-2027")).toBe(2026);
    expect(seasonStartYear("2026")).toBe(2026);
    expect(seasonStartYear("saison prochaine")).toBeNull();
  });
});
