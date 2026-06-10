/**
 * Contrat enchères : RETRAIT INSUFFISANT, pas de dette (règle 3.2.c.4).
 * Pénalité de 2 retraits (2 joueurs manquants dans la mise) mais 1 seule
 * acquisition au tour -> on ne retire qu'1 joueur. Aucune dette portée au
 * tour suivant.
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-retrait-insuffisant.ts
 */

import { resolveRound, type ParticipantInput } from "../src/lib/auction-engine";
import { player, check, finish } from "./lib/test-encheres-helpers";

// Participant 1 : mise sur 11 joueurs seulement (2 manquants -> pénalité 2).
const p1Squad = [
  player("Gardien", "GK"),
  ...["Da", "Db", "Dc", "Dd"].map((n) => player(n, "DEF")),
  ...["Ma", "Mb", "Mc", "Md"].map((n) => player(n, "MID")),
  ...["Aa", "Ab"].map((n) => player(n, "ATT")),
];
// Le participant 2 le surenchérit sur 10 des 11 (tous sauf le milieu "Md").
const sniped = p1Squad.filter((p) => p.lastName !== "Md");

const participants: ParticipantInput[] = [
  {
    userId: 1,
    budget: 130,
    owned: [],
    bids: p1Squad.map((p) => ({ player: p, amount: 5 })),
  },
  {
    userId: 2,
    budget: 130,
    owned: [],
    bids: [
      ...sniped.map((p) => ({ player: p, amount: 8 })),
      // Complète à 13 pour rester valide : 2 MID + 1 ATT à lui.
      { player: player("Mx", "MID"), amount: 5 },
      { player: player("My", "MID"), amount: 5 },
      { player: player("Ax", "ATT"), amount: 5 },
    ],
  },
];

const outcome = resolveRound(participants);

const p1Acquisitions = outcome.acquisitions.filter((a) => a.userId === 1);
const p1Removals = outcome.removals.filter((r) => r.userId === 1);

check("participant 1 n'a gagné qu'1 joueur avant pénalité (le reste sniped)", p1Acquisitions.length + p1Removals.length, 1);
check("1 seul retrait appliqué (pas 2 : pas de dette)", p1Removals.length, 1);
check("motif = moins de 13 joueurs misés", p1Removals[0]?.reason, "Moins de 13 joueurs misés");
check("participant 1 finit le tour avec 0 acquisition", p1Acquisitions.length, 0);
check("budget participant 1 intact (tout est rendu)", outcome.budgetsAfter.get(1), 130);
check("budget jamais négatif, aucune dette", (outcome.budgetsAfter.get(1) ?? 0) >= 0, true);

// ── Sanity-check : une régression "dette portée" se matérialiserait par un
// budget < 130 (retrait fantôme décompté) ou un compteur de retraits à 2.
const buggyRemovalCount = 2;
check("sanity-check : la régression 'dette portée' serait détectée", buggyRemovalCount !== p1Removals.length, true);

finish();
