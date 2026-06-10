/**
 * Contrat enchères : EXCÈS D'ATTAQUANTS (règle 3.2.c).
 * 5 attaquants misés (max 4) et 5 obtenus -> retrait d'1 attaquant,
 * le plus cher de la ligne (pas d'un joueur d'une autre ligne).
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-encheres-depassement-attaquants.ts
 */

import { resolveRound, type ParticipantInput } from "../src/lib/auction-engine";
import { player, check, finish } from "./lib/test-encheres-helpers";

// 13 joueurs avec 5 ATT : 1 GK, 4 DEF, 3 MID, 5 ATT.
const gk = player("Gardien", "GK");
const defs = ["Da", "Db", "Dc", "Dd"].map((n) => player(n, "DEF"));
const mids = ["Ma", "Mb", "Mc"].map((n) => player(n, "MID"));
const atts = ["Aa", "Ab", "Ac", "Ad", "Ae"].map((n) => player(n, "ATT"));

const participants: ParticipantInput[] = [
  {
    userId: 1,
    budget: 130,
    owned: [],
    bids: [
      { player: gk, amount: 10 },
      ...defs.map((p) => ({ player: p, amount: 5 })),
      ...mids.map((p) => ({ player: p, amount: 5 })),
      // L'attaquant "Ae" est le plus cher de la ligne (25), mais le gardien
      // à 10 et un défenseur à 20 existent pour vérifier que le retrait
      // reste DANS la ligne ATT.
      ...atts.map((p, i) => ({ player: p, amount: i === 4 ? 25 : 8 })),
    ],
  },
];
participants[0].bids.find((b) => b.player.lastName === "Da")!.amount = 20;

const outcome = resolveRound(participants);

check("1 retrait appliqué", outcome.removals.length, 1);
check("motif = attaquants en excès", outcome.removals[0]?.reason, "Attaquants en excès dans la mise");
check("le retrait est un attaquant (pas le DEF à 20)", outcome.removals[0]?.player.line, "ATT");
check("c'est l'attaquant le plus cher (Ae à 25)", outcome.removals[0]?.player.lastName, "Ae");
check("le défenseur à 20 reste acquis", outcome.acquisitions.some((a) => a.player.lastName === "Da"), true);
check("4 attaquants restants", outcome.acquisitions.filter((a) => a.player.line === "ATT").length, 4);

// ── Sanity-check : régression "retrait hors ligne" (retire la plus grosse
// acquisition toutes lignes confondues = Ae à 25 ici... prenons le cas où le
// DEF à 20 serait retiré si Ae valait 15). On rejoue avec Ae à 15 : la plus
// grosse acquisition globale est alors le DEF à 20, mais le retrait doit
// TOUJOURS être un ATT.
const participants2: ParticipantInput[] = [
  {
    userId: 1,
    budget: 130,
    owned: [],
    bids: [
      { player: player("Gk2", "GK"), amount: 10 },
      { player: player("Dx", "DEF"), amount: 20 },
      ...["Dy", "Dz", "Dw"].map((n) => ({ player: player(n, "DEF"), amount: 5 })),
      ...["Mx", "My", "Mz"].map((n) => ({ player: player(n, "MID"), amount: 5 })),
      ...["Ax", "Ay", "Az", "Aw"].map((n) => ({ player: player(n, "ATT"), amount: 8 })),
      { player: player("Av", "ATT"), amount: 15 },
    ],
  },
];
const outcome2 = resolveRound(participants2);
check("sanity-check : retrait dans la ligne même si un DEF est plus cher", outcome2.removals[0]?.player.lastName, "Av");
check("sanity-check : le DEF à 20 n'est jamais retiré", outcome2.acquisitions.some((a) => a.player.lastName === "Dx"), true);

finish();
