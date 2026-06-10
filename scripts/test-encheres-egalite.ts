/**
 * Contrat enchères : ÉGALITÉ de mise (règle 3.2.a).
 * 2 participants misent le même montant sur le même joueur
 *   -> PERSONNE ne l'obtient (ni premier arrivé, ni alphabétique)
 *   -> les points sont rendus aux deux (budget intact)
 *   -> le joueur est remis en jeu (présent dans `ties`).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-egalite.ts
 */

import { resolveRound, type ParticipantInput } from "../src/lib/auction-engine";
import { player, validSquad, check, finish } from "./lib/test-encheres-helpers";

const mbappe = player("Mbappe", "ATT");

function makeRound(): ParticipantInput[] {
  // Chaque participant mise sur son propre squad valide + Mbappé à 50, même montant.
  const mkBids = (prefix: string) => {
    const squad = validSquad(prefix);
    // On remplace un attaquant par Mbappé pour garder 13 joueurs valides.
    const bids = squad.slice(0, 12).map((p) => ({ player: p, amount: 5 }));
    bids.push({ player: mbappe, amount: 50 });
    return bids;
  };
  return [
    { userId: 1, budget: 130, owned: [], bids: mkBids("a") },
    { userId: 2, budget: 130, owned: [], bids: mkBids("b") },
  ];
}

const outcome = resolveRound(makeRound());

const mbappeAcquired = outcome.acquisitions.some((a) => a.player.id === mbappe.id);
const tie = outcome.ties.find((t) => t.playerId === mbappe.id);

check("Mbappé n'est attribué à personne", mbappeAcquired, false);
check("l'égalité est tracée avec les 2 participants", tie?.userIds.sort(), [1, 2]);
// Points rendus : chaque participant a obtenu ses 12 autres joueurs à 5 pts
// (60 pts), les 50 de Mbappé ne sont PAS décomptés.
check("budget participant 1 après tour (130 - 60)", outcome.budgetsAfter.get(1), 70);
check("budget participant 2 après tour (130 - 60)", outcome.budgetsAfter.get(2), 70);

// ── Sanity-check : le détecteur attrape bien la régression "attribué au
// premier arrivé". On simule un résultat bugué (Mbappé attribué au user 1,
// 50 pts décomptés) et on vérifie que les assertions ci-dessus le rejettent.
const buggyAcquired = true; // Mbappé attribué dans le monde bugué
const buggyBudget1 = 130 - 60 - 50; // 50 pts décomptés à tort
const detects =
  buggyAcquired !== mbappeAcquired || buggyBudget1 !== outcome.budgetsAfter.get(1);
check("sanity-check : la régression 'premier arrivé' serait détectée", detects, true);

finish();
