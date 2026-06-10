/**
 * Contrat enchères : mise SANS GARDIEN (règle 3.2.c).
 * Une mise sans aucun gardien -> retrait d'1 joueur, appliqué sur
 * l'acquisition LA PLUS CHÈRE du tour ; en cas d'égalité de montant,
 * ordre alphabétique (nom de famille).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-quota-gardien.ts
 */

import { resolveRound, type ParticipantInput } from "../src/lib/auction-engine";
import { player, check, finish } from "./lib/test-encheres-helpers";

// 13 joueurs SANS gardien : 5 DEF, 5 MID, 3 ATT. Acquisition la plus chère :
// deux joueurs à 30 pts -> l'alphabétique ("Aubert" avant "Zidane") part.
const squad = [
  ...["Bernard", "Castro", "Durand", "Evra"].map((n) => player(n, "DEF")),
  player("Zidane", "DEF"),
  ...["Fofana", "Giroud", "Henry", "Iborra", "Juminez"].map((n) => player(n, "MID")),
  ...["Kant", "Lacazette"].map((n) => player(n, "ATT")),
  player("Aubert", "ATT"),
];

const participants: ParticipantInput[] = [
  {
    userId: 1,
    budget: 130,
    owned: [],
    bids: squad.map((p) => ({
      player: p,
      // Zidane (DEF) et Aubert (ATT) à 30 pts, le reste à 5.
      amount: p.lastName === "Zidane" || p.lastName === "Aubert" ? 30 : 5,
    })),
  },
];

const outcome = resolveRound(participants);

check("1 retrait appliqué", outcome.removals.length, 1);
check("motif = absence de gardien", outcome.removals[0]?.reason, "Absence de gardien dans la mise");
check(
  "le retrait porte sur la plus chère, alphabétique en cas d'égalité (Aubert avant Zidane)",
  outcome.removals[0]?.player.lastName,
  "Aubert"
);
check("Aubert n'est plus dans les acquisitions", outcome.acquisitions.some((a) => a.player.lastName === "Aubert"), false);
check("Zidane reste acquis", outcome.acquisitions.some((a) => a.player.lastName === "Zidane"), true);
// Points du retrait rendus : 13 mises = 11x5 + 2x30 = 115 ; acquis final = 115 - 30 (Aubert) = 85.
check("budget après tour (130 - 85)", outcome.budgetsAfter.get(1), 45);

// ── Sanity-check : une régression "aucune pénalité sans gardien" donnerait
// 0 retrait et un budget de 130 - 115 = 15. Le détecteur doit la voir.
const buggyRemovals = 0;
const buggyBudget = 15;
const detects = buggyRemovals !== outcome.removals.length || buggyBudget !== outcome.budgetsAfter.get(1);
check("sanity-check : la régression 'pas de pénalité' serait détectée", detects, true);

finish();
