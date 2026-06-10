/**
 * Contrat enchères : DÉPASSEMENT DE BUDGET (règle 3.2.c).
 * Une mise totalisant 131 pts pour un budget de 130 -> retrait d'1 joueur
 * (la plus grosse acquisition du tour).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-depassement-budget.ts
 */

import { resolveRound, type ParticipantInput } from "../src/lib/auction-engine";
import { validSquad, check, finish } from "./lib/test-encheres-helpers";

const squad = validSquad("u1");
// 13 mises totalisant 131 : 12 joueurs à 9 pts (108) + le gardien à 23.
const participants: ParticipantInput[] = [
  {
    userId: 1,
    budget: 130,
    owned: [],
    bids: squad.map((p) => ({ player: p, amount: p.line === "GK" ? 23 : 9 })),
  },
];

const total = participants[0].bids.reduce((s, b) => s + b.amount, 0);
check("précondition : la mise totalise bien 131", total, 131);

const outcome = resolveRound(participants);

check("1 retrait appliqué", outcome.removals.length, 1);
check("motif = dépassement de budget", outcome.removals[0]?.reason, "Total des mises supérieur au budget disponible");
check("le retrait porte sur la plus grosse acquisition (le gardien à 23)", outcome.removals[0]?.amount, 23);
check("12 acquisitions restantes", outcome.acquisitions.length, 12);
check("budget après tour (130 - 108)", outcome.budgetsAfter.get(1), 22);

// ── Sanity-check : régression "dépassement accepté sans pénalité" =
// 13 acquisitions et budget négatif (130 - 131 = -1). Détectée ?
const buggyAcquisitions = 13;
const buggyBudget = -1;
const detects =
  buggyAcquisitions !== outcome.acquisitions.length || buggyBudget !== outcome.budgetsAfter.get(1);
check("sanity-check : la régression 'budget dépassé toléré' serait détectée", detects, true);

finish();
