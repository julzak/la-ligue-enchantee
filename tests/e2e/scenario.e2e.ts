/**
 * Étage 3 (bout en bout) : une enchère complète, 4 participants, 2 tours +
 * fin de phase, pilotée en HTTP. Couvre les 5 cas du contrat (égalité,
 * gardien manquant, excès de ligne, report des points, complétion d'office)
 * et vérifie l'écriture des effectifs dans TEAM. Le dépassement de budget à
 * la soumission est couvert dans guards.e2e.ts ; la pénalité de budget au
 * dépouillement l'est par les tests unitaires (auction-engine.test.ts).
 *
 * Attendus calculés à la main, assertions sur compteurs/quotas/budget (pas
 * sur l'identité exacte du joueur retiré, qui dépend de l'ordre alphabétique).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  login, submitBids, adminAction, myResults,
  resetAuction, loadFixture, teamCount, teamLineCounts,
  type Session, type Fixture, closeHarness,
} from "./harness";

let admin: Session, j1: Session, j2: Session, j3: Session, j4: Session, fx: Fixture;
const bid = (playerId: number, amount: number) => ({ playerId, amount });

beforeAll(async () => {
  [admin, j1, j2, j3, j4] = await Promise.all(
    ["RecetteAdmin", "Joueur1", "Joueur2", "Joueur3", "Joueur4"].map(login)
  );
  fx = await loadFixture();
  await resetAuction();
}, 60_000);
afterAll(closeHarness);

describe("Enchère complète — 2 tours + constitution des effectifs", () => {
  it("précondition : fixture suffisante", () => {
    expect(fx.gkClubs.length).toBeGreaterThanOrEqual(4);
    expect(fx.def.length).toBeGreaterThanOrEqual(19);
    expect(fx.mid.length).toBeGreaterThanOrEqual(17);
    expect(fx.att.length).toBeGreaterThanOrEqual(15);
  });

  it("tour 1 : soumissions acceptées (dont 1 sans gardien, 1 à 5 attaquants)", async () => {
    const TIE = fx.def[0]; // disputé J1=J2 au même montant max
    const r1 = await submitBids(j1, [
      bid(fx.gkClubs[0], 10), bid(TIE, 30),
      ...fx.def.slice(1, 5).map((p) => bid(p, 5)),
      ...fx.mid.slice(0, 4).map((p) => bid(p, 5)),
      ...fx.att.slice(0, 3).map((p) => bid(p, 10)),
    ]); // 13 joueurs, total 110
    const r2 = await submitBids(j2, [
      bid(fx.gkClubs[1], 10), bid(TIE, 30),
      ...fx.def.slice(5, 9).map((p) => bid(p, 5)),
      ...fx.mid.slice(4, 8).map((p) => bid(p, 5)),
      ...fx.att.slice(3, 6).map((p) => bid(p, 10)),
    ]);
    const r3 = await submitBids(j3, [ // SANS gardien, 13 joueurs de champ @8
      ...fx.def.slice(9, 14).map((p) => bid(p, 8)),
      ...fx.mid.slice(8, 12).map((p) => bid(p, 8)),
      ...fx.att.slice(6, 10).map((p) => bid(p, 8)),
    ]);
    const r4 = await submitBids(j4, [ // 5 attaquants (excès de ligne)
      bid(fx.gkClubs[2], 10),
      ...fx.def.slice(14, 17).map((p) => bid(p, 5)),
      ...fx.mid.slice(12, 16).map((p) => bid(p, 5)),
      ...fx.att.slice(10, 15).map((p) => bid(p, 10)),
    ]);
    for (const r of [r1, r2, r3, r4]) expect(r.body.ok).toBe(true);
  });

  it("tour 1 : dépouillement applique le règlement", async () => {
    expect((await adminAction(admin, "close-round")).body.ok ?? true).not.toBe(false);
    const res = await adminAction(admin, "resolve-round");
    expect(res.body.ok ?? true).not.toBe(false);

    const [R1, R2, R3, R4] = await Promise.all([myResults(j1), myResults(j2), myResults(j3), myResults(j4)]);
    const TIE = fx.def[0];

    // Égalité : ni J1 ni J2 n'obtient le joueur disputé ; chacun garde ses 12 autres
    expect(R1.body.playersWon).toBe(12);
    expect(R2.body.playersWon).toBe(12);
    const wonIds = (R: any) => (R.body.myAcquisitions ?? []).map((a: any) => a.playerId);
    expect(wonIds(R1)).not.toContain(TIE);
    expect(wonIds(R2)).not.toContain(TIE);
    // Report des points : les 30 misés sur le joueur perdu sont rendus (130 - 80 acquis = 50)
    expect(R1.body.budgetRemaining).toBe(50);
    expect(R2.body.budgetRemaining).toBe(50);

    // Gardien manquant : J3 pénalisé (≥1 retrait), reste 12, toujours 0 gardien
    expect(R3.body.myRemovals.length).toBeGreaterThanOrEqual(1);
    expect(R3.body.playersWon).toBe(12);

    // Excès d'attaquants : J4 pénalisé d'1 retrait, reste 12
    expect(R4.body.myRemovals.length).toBeGreaterThanOrEqual(1);
    expect(R4.body.playersWon).toBe(12);
  });

  it("tour 2 : complément des effectifs (report des acquis)", async () => {
    expect((await adminAction(admin, "open")).body.ok ?? true).not.toBe(false);
    // J1 et J2 complètent à 13 ; J3 acquiert enfin son gardien ; J4 ne mise rien
    await submitBids(j1, [bid(fx.def[17], 10)]);
    await submitBids(j2, [bid(fx.mid[16], 10)]);
    await submitBids(j3, [bid(fx.gkClubs[3], 10)]);

    await adminAction(admin, "close-round");
    await adminAction(admin, "resolve-round");

    const [R1, R3, R4] = await Promise.all([myResults(j1), myResults(j3), myResults(j4)]);
    expect(R1.body.playersWon).toBe(13);
    expect(R3.body.playersWon).toBe(13); // a désormais un gardien
    expect(R4.body.playersWon).toBe(12); // en sous-nombre, sera complété d'office
  });

  it("fin de phase : complétion d'office + écriture des effectifs dans TEAM", async () => {
    // Complétion d'office de J4 (1 joueur à 1 pt) — joueur libre non utilisé
    const comp = await adminAction(admin, "complete-roster", {
      userId: j4.userId,
      playerIds: [fx.def[18]],
    });
    expect(comp.body.ok ?? true).not.toBe(false);

    const close = await adminAction(admin, "close-phase");
    expect(close.body.ok ?? true).not.toBe(false);

    // Chaque participant a exactement 13 joueurs, quotas valides
    for (const u of [j1, j2, j3, j4]) {
      expect(await teamCount(u.userId)).toBe(13);
      const q = await teamLineCounts(u.userId);
      expect(q.GK).toBe(1);
      expect(q.DEF).toBeGreaterThanOrEqual(3);
      expect(q.DEF).toBeLessThanOrEqual(6);
      expect(q.MID).toBeGreaterThanOrEqual(3);
      expect(q.MID).toBeLessThanOrEqual(6);
      expect(q.ATT).toBeGreaterThanOrEqual(1);
      expect(q.ATT).toBeLessThanOrEqual(4);
    }
  });
});
