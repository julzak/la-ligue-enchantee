/**
 * Contrat enchères : REPORT DES POINTS (règle 3.2.b).
 * Un participant mise 130 pts au tour 1 et n'obtient que 80 pts de joueurs
 * (50 pts de mises perdues) -> il entame le tour 2 avec 130 - 80 = 50 pts,
 * c'est-à-dire que les 50 pts misés sur des joueurs perdus sont RÉCUPÉRÉS.
 * Régression gardée : un calcul de budget qui ne tracerait que les
 * acquisitions sans rendre les mises perdues.
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-report-points.ts
 */

import { resolveRound, type ParticipantInput } from "../src/lib/auction-engine";
import { player, validSquad, check, finish } from "./lib/test-encheres-helpers";

// Le participant 1 mise 130 au total : son squad de 12 joueurs "sûrs" à
// 80 pts cumulés + 50 pts sur Mbappé, que le participant 2 lui souffle à 60.
const mbappe = player("Mbappe", "ATT");
const squad1 = validSquad("u1").slice(0, 12); // 1 GK, 4 DEF, 5 MID, 2 ATT
const amounts = [13, 7, 7, 7, 7, 6, 6, 6, 6, 5, 5, 5]; // total 80

const participant1: ParticipantInput = {
  userId: 1,
  budget: 130,
  owned: [],
  bids: [
    ...squad1.map((p, i) => ({ player: p, amount: amounts[i] })),
    { player: mbappe, amount: 50 },
  ],
};
const participant2: ParticipantInput = {
  userId: 2,
  budget: 130,
  owned: [],
  bids: [
    ...validSquad("u2").slice(0, 12).map((p) => ({ player: p, amount: 5 })),
    { player: mbappe, amount: 60 },
  ],
};

check("précondition : participant 1 mise bien 130", participant1.bids.reduce((s, b) => s + b.amount, 0), 130);

const outcome = resolveRound([participant1, participant2]);

check("participant 1 perd Mbappé", outcome.lostBids.some((l) => l.userId === 1 && l.playerId === mbappe.id), true);
check("participant 1 obtient ses 12 autres joueurs", outcome.acquisitions.filter((a) => a.userId === 1).length, 12);
check("budget participant 1 au tour 2 = 50 (les 50 pts perdus sont rendus)", outcome.budgetsAfter.get(1), 50);
check("budget participant 2 au tour 2 = 130 - 60 - 60", outcome.budgetsAfter.get(2), 10);

// ── Sanity-check : la régression "budget = 130 - total misé" (mises perdues
// non rendues) donnerait 0 pour le participant 1. Détectée ?
const buggyBudget = 130 - 130;
check("sanity-check : la régression 'mises perdues non rendues' serait détectée", buggyBudget !== outcome.budgetsAfter.get(1), true);

finish();
