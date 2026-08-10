/**
 * Étage 2 (couche route) : les gardes de soumission de /api/auction, testées
 * via HTTP contre l'app réelle. Vérifie le câblage handler + auth + DB, que
 * les tests unitaires purs (helpers) ne couvrent pas.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  login, submitBids, adminAction, apiGetAnon, myState,
  resetAuction, loadFixture, type Session, type Fixture, LEAGUE_ID, closeHarness,
} from "./harness";

let admin: Session, j1: Session, fx: Fixture;

// Construit une mise valide de 13 joueurs (1 GK club, 5 DEF, 4 MID, 3 ATT) à 10 pts.
function validSquad(fx: Fixture) {
  return [
    { playerId: fx.gkClubs[0], amount: 10 },
    ...fx.def.slice(0, 5).map((id) => ({ playerId: id, amount: 10 })),
    ...fx.mid.slice(0, 4).map((id) => ({ playerId: id, amount: 10 })),
    ...fx.att.slice(0, 3).map((id) => ({ playerId: id, amount: 10 })),
  ];
}

beforeAll(async () => {
  admin = await login("RecetteAdmin");
  j1 = await login("Joueur1");
  fx = await loadFixture();
  await resetAuction();
});
afterAll(closeHarness);

describe("Couche route — gardes de soumission", () => {
  it("auth : GET /api/auction sans session → 401", async () => {
    const r = await apiGetAnon(`/api/auction?leagueId=${LEAGUE_ID}`);
    expect(r.status).toBe(401);
  });

  it("mise valide de 13 joueurs acceptée (contrôle)", async () => {
    const r = await submitBids(j1, validSquad(fx));
    expect(r.body.ok).toBe(true);
  });

  it("B1 : mise sur un gardien NOMMÉ rejetée", async () => {
    const squad = validSquad(fx);
    squad[0] = { playerId: fx.namedGk[0], amount: 10 }; // remplace le GK club par un GK nommé
    const r = await submitBids(j1, squad);
    expect(r.body.ok).not.toBe(true);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it("B2 : deux gardiens (clubs) dans la mise rejetés", async () => {
    const squad = validSquad(fx);
    squad[1] = { playerId: fx.gkClubs[1], amount: 10 }; // 2e gardien club à la place d'un DEF
    const r = await submitBids(j1, squad);
    expect(r.body.ok).not.toBe(true);
  });

  it("B3 : playerId en doublon dans la mise rejeté", async () => {
    const squad = validSquad(fx);
    squad[2] = { playerId: squad[1].playerId, amount: 10 }; // doublon
    const r = await submitBids(j1, squad);
    expect(r.body.ok).not.toBe(true);
  });

  it("garde-fou ferme : total des mises > 130 REFUSÉ à la soumission (400)", async () => {
    // Décision 2026-08-10 : le dépassement de budget est un refus ferme
    // (plus une pénalité au dépouillement). 13 × 11 = 143 > 130 → 400.
    const squad = validSquad(fx).map((b) => ({ ...b, amount: 11 }));
    const r = await submitBids(j1, squad);
    expect(r.body.ok).not.toBe(true);
    expect(r.status).toBe(400);
  });

  it("garde-fou ferme : 14 joueurs misés REFUSÉS à la soumission (400)", async () => {
    // Décision 2026-08-10 : cas réel « 14 joueurs / 131 pts » du tour 1 L2.
    const squad = [...validSquad(fx), { playerId: fx.def[5], amount: 1 }];
    const r = await submitBids(j1, squad);
    expect(r.body.ok).not.toBe(true);
    expect(r.status).toBe(400);
  });

  it("garde-fou ferme : 5 attaquants misés REFUSÉS à la soumission (400)", async () => {
    // Remplace 2 MIL par 2 ATT : 5 ATT au total, maximum de ligne 4.
    const squad = [
      { playerId: fx.gkClubs[0], amount: 10 },
      ...fx.def.slice(0, 5).map((id) => ({ playerId: id, amount: 10 })),
      ...fx.mid.slice(0, 2).map((id) => ({ playerId: id, amount: 10 })),
      ...fx.att.slice(0, 5).map((id) => ({ playerId: id, amount: 10 })),
    ];
    const r = await submitBids(j1, squad);
    expect(r.body.ok).not.toBe(true);
    expect(r.status).toBe(400);
  });

  it("set-deadline : une date déjà passée est refusée (garde-fou)", async () => {
    const r = await adminAction(admin, "set-deadline", {
      deadline: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(r.body.ok).not.toBe(true);
  });

  describe("deadline (tolérance zéro)", () => {
    beforeAll(async () => {
      // butoir dans 2 s (accepté car futur), puis on laisse passer
      await adminAction(admin, "set-deadline", { deadline: new Date(Date.now() + 2_000).toISOString() });
      await new Promise((r) => setTimeout(r, 2_600));
    });
    afterAll(async () => {
      await adminAction(admin, "set-deadline", { deadline: null });
    });

    it("mise après l'heure butoir rejetée (403)", async () => {
      const r = await submitBids(j1, validSquad(fx));
      expect(r.body.ok).not.toBe(true);
      expect(r.status).toBe(403);
    });
  });

  it("contrôle final : butoir levé → mise de nouveau acceptée", async () => {
    const r = await submitBids(j1, validSquad(fx));
    expect(r.body.ok).toBe(true);
  });
});
