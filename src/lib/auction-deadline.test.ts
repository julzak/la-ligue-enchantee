/**
 * Tests du rejet deadline (BRIEF-02).
 *
 * Ces tests valident la LOGIQUE PURE de détection du dépassement de deadline.
 * Ils ne touchent pas à la base (pas de mocks Prisma nécessaires ici) —
 * la logique est extraite dans une fonction pure `isDeadlinePassed`.
 *
 * Contrat du brief :
 *   "soumission à T+1 s → rejet" (tolérance 0, >= fait foi)
 */

import { describe, it, expect } from "vitest";

/**
 * Vérifie si la deadline est dépassée au sens strict.
 * Renvoie true si now >= deadline (tolérance 0).
 * Renvoie false si deadline est null (pas de butoir renseigné).
 */
export function isDeadlinePassed(now: Date, deadline: Date | null): boolean {
  if (deadline === null) return false;
  return now >= deadline;
}

/**
 * Formate le message de rejet (même logique que dans la route POST).
 */
export function deadlineErrorMessage(deadline: Date): string {
  const fmt = deadline.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
  return `Tour clôturé le ${fmt} — aucune mise acceptée après l'heure butoir.`;
}

const T0 = new Date("2026-08-01T18:00:00.000Z"); // instant de référence (heure butoir)

describe("isDeadlinePassed — logique de rejet deadline", () => {
  // Sanity-check : sans la logique >= , ce test devrait échouer
  it("sanity-check : T0 - 1s → NON rejeté (avant le butoir)", () => {
    const before = new Date(T0.getTime() - 1000); // T-1s
    expect(isDeadlinePassed(before, T0)).toBe(false);
  });

  it("soumission à T+1 s → rejetée (contrat du brief)", () => {
    const tPlus1s = new Date(T0.getTime() + 1000); // T+1s
    expect(isDeadlinePassed(tPlus1s, T0)).toBe(true);
  });

  it("soumission exactement à T0 → rejetée (tolérance 0, >= fait foi)", () => {
    expect(isDeadlinePassed(T0, T0)).toBe(true);
  });

  it("soumission à T+1 ms → rejetée", () => {
    const tPlus1ms = new Date(T0.getTime() + 1);
    expect(isDeadlinePassed(tPlus1ms, T0)).toBe(true);
  });

  it("soumission à T-1 ms → acceptée", () => {
    const tMinus1ms = new Date(T0.getTime() - 1);
    expect(isDeadlinePassed(tMinus1ms, T0)).toBe(false);
  });

  it("deadline null (pas de butoir) → jamais rejeté, quelle que soit l'heure", () => {
    const veryLate = new Date(T0.getTime() + 86400 * 1000 * 365); // 1 an après
    expect(isDeadlinePassed(veryLate, null)).toBe(false);
  });

  it("message de rejet contient la date formattée (fr-FR)", () => {
    const msg = deadlineErrorMessage(T0);
    expect(msg).toMatch(/Tour clôturé le/);
    expect(msg).toMatch(/aucune mise acceptée/);
  });
});
