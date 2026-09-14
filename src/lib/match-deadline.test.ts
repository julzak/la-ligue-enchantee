import { describe, it, expect } from "vitest";
import { parisUtcOffsetHours } from "./paris-time";
import { DEFAULT_DEADLINE_CONFIG, deadlineForDate, matchTimeToWall, earliestKickoff } from "./match-deadline";

// Cas réel (signalement Pierre 2026-09-14) : Lille-Troyes J4, dimanche
// 2026-09-13 à 15h Paris. En base : match_time TIME '15:00:00', que Prisma
// renvoie comme Date 1970-01-01T15:00:00Z.
const LILLE_TROYES_TIME = new Date("1970-01-01T15:00:00Z");
const LILLE_TROYES_DATE = "2026-09-13";

describe("matchTimeToWall : match_time est une heure de Paris, pas de l'UTC", () => {
  it("lit la Date Prisma d'une colonne TIME comme heure murale", () => {
    expect(matchTimeToWall(LILLE_TROYES_TIME)).toEqual({ hour: 15, minute: 0 });
    expect(matchTimeToWall(new Date("1970-01-01T20:45:00Z"))).toEqual({ hour: 20, minute: 45 });
  });

  it("accepte aussi une chaîne HH:MM[:SS]", () => {
    expect(matchTimeToWall("17:15:00")).toEqual({ hour: 17, minute: 15 });
    expect(matchTimeToWall("9:05")).toEqual({ hour: 9, minute: 5 });
  });

  it("renvoie null si absent ou illisible", () => {
    expect(matchTimeToWall(null)).toBeNull();
    expect(matchTimeToWall(undefined)).toBeNull();
    expect(matchTimeToWall(new Date("invalid"))).toBeNull();
    expect(matchTimeToWall("Thu Jan 01 1970")).toBeNull();
  });

  it("sanity-check : l'ancienne lecture UTC + offset Paris donnait 17h, ce que le test ne tolère plus", () => {
    const buggyHour = LILLE_TROYES_TIME.getUTCHours() + parisUtcOffsetHours(new Date(LILLE_TROYES_DATE));
    expect(buggyHour).toBe(17);
    expect(matchTimeToWall(LILLE_TROYES_TIME)!.hour).not.toBe(buggyHour);
  });
});

describe("deadlineForDate : match avant 17h -> coup d'envoi - 2h, sinon 15h", () => {
  it("Lille-Troyes dimanche 15h -> deadline 13h Paris (11h UTC en été)", () => {
    const d = deadlineForDate(LILLE_TROYES_DATE, [matchTimeToWall(LILLE_TROYES_TIME)!], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2026-09-13T11:00:00.000Z");
  });

  it("sanity-check : l'ancien calcul (15h lu comme 17h) donnait 15h Paris = 13h UTC", () => {
    const buggy = deadlineForDate(LILLE_TROYES_DATE, [{ hour: 17, minute: 0 }], DEFAULT_DEADLINE_CONFIG);
    expect(buggy.toISOString()).toBe("2026-09-13T13:00:00.000Z");
    const fixed = deadlineForDate(LILLE_TROYES_DATE, [matchTimeToWall(LILLE_TROYES_TIME)!], DEFAULT_DEADLINE_CONFIG);
    expect(fixed.getTime()).not.toBe(buggy.getTime());
  });

  it("le premier coup d'envoi du jour fait foi (15h et 17h15 le même dimanche -> 13h)", () => {
    const d = deadlineForDate(LILLE_TROYES_DATE, [{ hour: 17, minute: 15 }, { hour: 15, minute: 0 }, { hour: 20, minute: 45 }], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2026-09-13T11:00:00.000Z");
    expect(earliestKickoff([{ hour: 17, minute: 15 }, { hour: 15, minute: 0 }])).toEqual({ hour: 15, minute: 0 });
  });

  it("17h15 n'est pas 'avant 17h' -> 15h par défaut", () => {
    const d = deadlineForDate("2026-09-12", [{ hour: 17, minute: 15 }], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2026-09-12T13:00:00.000Z");
  });

  it("soirée 20h45 -> 15h par défaut", () => {
    const d = deadlineForDate("2026-09-11", [{ hour: 20, minute: 45 }], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2026-09-11T13:00:00.000Z");
  });

  it("les minutes comptent : 16h30 -> 14h30", () => {
    const d = deadlineForDate("2026-09-13", [{ hour: 16, minute: 30 }], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2026-09-13T12:30:00.000Z");
  });

  it("heure inconnue -> traitée comme un match du soir -> 15h", () => {
    const d = deadlineForDate("2026-09-13", [], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2026-09-13T13:00:00.000Z");
  });

  it("en hiver l'offset Paris est +1 : dimanche 15h en janvier -> 13h Paris = 12h UTC", () => {
    const d = deadlineForDate("2027-01-10", [{ hour: 15, minute: 0 }], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2027-01-10T12:00:00.000Z");
  });

  it("borne : la deadline ne recule jamais avant minuit le jour du match", () => {
    const d = deadlineForDate("2026-09-13", [{ hour: 1, minute: 0 }], DEFAULT_DEADLINE_CONFIG);
    expect(d.toISOString()).toBe("2026-09-12T22:00:00.000Z");
  });
});
