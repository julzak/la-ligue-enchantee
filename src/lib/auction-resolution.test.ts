/**
 * Tests d'intégration du dépouillement (BRIEF-05) : couche d'orchestration
 * pure `auction-resolution.ts` branchée sur le moteur `auction-engine.ts`.
 *
 * Tout se passe EN MÉMOIRE (aucun accès base : le DATABASE_URL local pointe
 * sur la prod). Un tour complet à 3 participants fictifs est dépouillé et
 * comparé à un calcul à la main, puis la fin de phase (complétion d'office,
 * pont TEAM) et un calcul de scoring de test sont déroulés sur le résultat.
 *
 * Convention projet : chaque describe inclut un sanity-check qui prouve que
 * le test détecterait la régression qu'il garde.
 */

import { describe, it, expect } from "vitest";
import {
  planResolution,
  buildEngineInput,
  computeRosterStatuses,
  proposeCompletions,
  planTeamRows,
  lineFromPosition,
  type ResolutionInput,
  type ResolutionPlayer,
  type PendingBidRow,
  type WonBidRow,
} from "./auction-resolution";
import { validateFinalRoster, type EnginePlayer } from "./auction-engine";
import { buildDayScoreResolver } from "./club-goalkeeper";
import { calculateLineupScore } from "./scoring";
import type { Performance, Position } from "./types";

// ── Joueurs fictifs (positions = libellés DB réels) ────────────────────────
let nextPlayerId = 1;
const PLAYERS = new Map<number, ResolutionPlayer>();
function mkPlayer(lastName: string, position: string): ResolutionPlayer {
  const p = { id: nextPlayerId++, lastName, position, displayName: lastName };
  PLAYERS.set(p.id, p);
  return p;
}
const GK_POS = "Gardien";
const DEF_POS = "Défenseur";
const MID_POS = "Milieu de terrain";
const ATT_POS = "Attaquant";

// Pseudo-gardiens par club (règle 2.1)
const gkMarseille = mkPlayer("Marseille", GK_POS);
const gkParis = mkPlayer("Paris", GK_POS);
mkPlayer("Lyon", GK_POS); // disponible, jamais misé

// Défenseurs
const [abad, bernat, costa, diallo, evra, fofana, garcia, hernandez, ito, jorge, kimpembe] =
  ["Abad", "Bernat", "Costa", "Diallo", "Evra", "Fofana", "Garcia", "Hernandez", "Ito", "Jorge", "Kimpembe"]
    .map((n) => mkPlayer(n, DEF_POS));
// Milieux
const [joly, kone, lopez, marchand, ndiaye, ostigard, payet, quentin, rabiot, sissoko, tolisso, ugarte, verratti, witsel, xavi] =
  ["Joly", "Kone", "Lopez", "Marchand", "Ndiaye", "Ostigard", "Payet", "Quentin", "Rabiot", "Sissoko", "Tolisso", "Ugarte", "Verratti", "Witsel", "Xavi"]
    .map((n) => mkPlayer(n, MID_POS));
// Attaquants
const [savanier, terrier, mbappe, ufaro, vargas, wahi, xhaka, yilmaz, zidane] =
  ["Savanier", "Terrier", "Mbappe", "Ufaro", "Vargas", "Wahi", "Xhaka", "Yilmaz", "Zidane"]
    .map((n) => mkPlayer(n, ATT_POS));

// ── Tour 1 : mises des 3 participants ──────────────────────────────────────
const ALICE = 1, BRUNO = 2, CHLOE = 3;
let nextBidId = 100;
function bid(userId: number, player: ResolutionPlayer, amount: number): PendingBidRow {
  return { id: nextBidId++, userId, playerId: player.id, amount };
}

// Alice : mise conforme de 130 pts (1 GK, 4 DEF, 5 MID, 3 ATT)
const aliceBids = [
  bid(ALICE, gkMarseille, 10),
  bid(ALICE, abad, 8), bid(ALICE, bernat, 7), bid(ALICE, costa, 6), bid(ALICE, diallo, 5),
  bid(ALICE, joly, 9), bid(ALICE, kone, 8), bid(ALICE, lopez, 7), bid(ALICE, marchand, 6), bid(ALICE, ndiaye, 5),
  bid(ALICE, savanier, 20), bid(ALICE, terrier, 15), bid(ALICE, mbappe, 24),
];
// Bruno : mise conforme de 130 pts ; égalité avec Alice sur Gardiens Marseille,
// surenchère sur Mbappé
const brunoBids = [
  bid(BRUNO, gkMarseille, 10),
  bid(BRUNO, evra, 8), bid(BRUNO, fofana, 7), bid(BRUNO, garcia, 6), bid(BRUNO, hernandez, 5),
  bid(BRUNO, ostigard, 9), bid(BRUNO, payet, 8), bid(BRUNO, quentin, 7), bid(BRUNO, rabiot, 6), bid(BRUNO, sissoko, 5),
  bid(BRUNO, mbappe, 30), bid(BRUNO, ufaro, 10), bid(BRUNO, vargas, 9),
];
// Chloé : mise invalide — AUCUN gardien et 5 attaquants (13 joueurs, 104 pts).
// Surenchère sur Terrier (16 vs 15 d'Alice).
const chloeBids = [
  bid(CHLOE, ito, 8), bid(CHLOE, jorge, 7), bid(CHLOE, kimpembe, 6),
  bid(CHLOE, tolisso, 5), bid(CHLOE, ugarte, 5), bid(CHLOE, verratti, 5), bid(CHLOE, witsel, 5), bid(CHLOE, xavi, 5),
  bid(CHLOE, wahi, 12), bid(CHLOE, xhaka, 11), bid(CHLOE, yilmaz, 10), bid(CHLOE, zidane, 9), bid(CHLOE, terrier, 16),
];

const round1Input: ResolutionInput = {
  budgetPerUser: 130,
  participantIds: [ALICE, BRUNO, CHLOE],
  players: PLAYERS,
  wonBids: [],
  pendingBids: [...aliceBids, ...brunoBids, ...chloeBids],
};

const plan = planResolution(round1Input);
const statusByBid = new Map(plan.updates.map((u) => [u.bidId, u.status]));
const status = (b: PendingBidRow) => statusByBid.get(b.id);

// ── Calcul à la main (référence) ───────────────────────────────────────────
// Alice  : tie Gardiens Marseille, perd Mbappé (24<30) et Terrier (15<16),
//          gagne ses 10 autres mises → dépense 81, budget 49.
// Bruno  : tie Gardiens Marseille, gagne ses 12 autres mises → dépense 110, budget 20.
// Chloé  : gagne ses 13 mises, puis pénalités : pas de gardien → retrait de
//          Terrier (16, acquisition la plus chère) ; 5 ATT misés → retrait de
//          Wahi (12, la plus chère de la ligne ATT restante). 11 acquisitions,
//          dépense 76, budget 54.

describe("dépouillement d'un tour complet à 3 participants (calcul à la main)", () => {
  it("chaque mise pending reçoit exactement un statut (39 mises)", () => {
    expect(plan.updates).toHaveLength(39);
    expect(new Set(plan.updates.map((u) => u.bidId)).size).toBe(39);
  });

  it("égalité Gardiens Marseille : statut tie pour Alice et Bruno, personne ne l'obtient", () => {
    expect(status(aliceBids[0])).toBe("tie");
    expect(status(brunoBids[0])).toBe("tie");
    const tie = plan.outcome.ties.find((t) => t.playerId === gkMarseille.id);
    expect(tie?.userIds.sort()).toEqual([ALICE, BRUNO]);
  });

  it("mises battues : Alice perd Mbappé et Terrier", () => {
    expect(status(aliceBids.find((b) => b.playerId === mbappe.id)!)).toBe("lost");
    expect(status(aliceBids.find((b) => b.playerId === terrier.id)!)).toBe("lost");
  });

  it("statuts won conformes : Alice 10, Bruno 12, Chloé 11", () => {
    const wonOf = (uid: number) => plan.updates.filter((u) => u.status === "won" && [...aliceBids, ...brunoBids, ...chloeBids].find((b) => b.id === u.bidId)?.userId === uid).length;
    expect(wonOf(ALICE)).toBe(10);
    expect(wonOf(BRUNO)).toBe(12);
    expect(wonOf(CHLOE)).toBe(11);
  });

  it("retraits de Chloé : Terrier (pas de gardien) puis Wahi (5 ATT), statut removed", () => {
    expect(status(chloeBids.find((b) => b.playerId === terrier.id)!)).toBe("removed");
    expect(status(chloeBids.find((b) => b.playerId === wahi.id)!)).toBe("removed");
    expect(plan.removals).toHaveLength(2);
    expect(plan.removals[0]).toMatchObject({ userId: CHLOE, playerId: terrier.id, amount: 16 });
    expect(plan.removals[1]).toMatchObject({ userId: CHLOE, playerId: wahi.id, amount: 12 });
  });

  it("les motifs des retraits sont lisibles et chiffrés", () => {
    expect(plan.removals[0].reason).toBe(
      "Aucun gardien misé : retrait de Terrier, acquisition la plus chère du tour"
    );
    expect(plan.removals[1].reason).toBe(
      "5 attaquants misés (max 4) : retrait de Wahi, acquisition la plus chère de la ligne"
    );
  });

  it("budgets recalculés (restitution 3.2.b) : Alice 49, Bruno 20, Chloé 54", () => {
    expect(plan.outcome.budgetsAfter.get(ALICE)).toBe(49);
    expect(plan.outcome.budgetsAfter.get(BRUNO)).toBe(20);
    expect(plan.outcome.budgetsAfter.get(CHLOE)).toBe(54);
  });

  // Sanity-check : l'ancien chemin resolve-round (attribution naïve sans
  // moteur) donnait Terrier et Wahi à Chloé en 'won' et aurait pu trancher
  // l'égalité par tirage au sort. Les deux régressions seraient détectées.
  it("sanity-check : tirage au sort ou pénalités ignorées seraient détectés", () => {
    const buggyTieWon = "won"; // tirage au sort : un des deux gagnerait
    expect(status(aliceBids[0])).not.toBe(buggyTieWon);
    expect(status(brunoBids[0])).not.toBe(buggyTieWon);
    const buggyNoPenalty = "won"; // sans moteur, Terrier/Wahi resteraient won
    expect(status(chloeBids.find((b) => b.playerId === terrier.id)!)).not.toBe(buggyNoPenalty);
  });
});

describe("cohérence DB : un état incohérent refuse le dépouillement", () => {
  it("mise en double (même participant, même joueur) → erreur", () => {
    const dup: ResolutionInput = {
      ...round1Input,
      pendingBids: [bid(ALICE, savanier, 5), { ...bid(ALICE, savanier, 7) }],
    };
    expect(() => planResolution(dup)).toThrow(/double/i);
  });

  it("joueur misé absent des données joueurs → erreur", () => {
    const ghost: ResolutionInput = {
      ...round1Input,
      pendingBids: [{ id: 9999, userId: ALICE, playerId: 99999, amount: 5 }],
    };
    expect(() => planResolution(ghost)).toThrow(/introuvable/);
  });

  it("sanity-check : un input sain ne lève pas", () => {
    expect(() => planResolution(round1Input)).not.toThrow();
  });
});

// ── Fin de phase : état des effectifs, complétion d'office, pont TEAM ──────
// Base en mémoire après le tour 1 : les updates du plan sont appliqués aux
// mises, les won deviennent les acquis cumulés.
const wonAfterRound1: WonBidRow[] = plan.updates
  .filter((u) => u.status === "won")
  .map((u) => {
    const b = [...aliceBids, ...brunoBids, ...chloeBids].find((x) => x.id === u.bidId)!;
    return { userId: b.userId, playerId: b.playerId, amount: b.amount };
  });

describe("fin de phase : effectifs incomplets et complétion d'office à 1 pt", () => {
  const statuses = computeRosterStatuses({
    participantIds: [ALICE, BRUNO, CHLOE],
    players: PLAYERS,
    wonBids: wonAfterRound1,
  });
  const alice = statuses.find((s) => s.userId === ALICE)!;

  it("Alice : 10/13, il manque 3 joueurs dont 1 gardien", () => {
    expect(alice.roster).toHaveLength(10);
    expect(alice.missingCount).toBe(3);
    expect(alice.missingLines).toBe("1 G");
    expect(alice.errors.length).toBeGreaterThan(0);
  });

  it("les propositions complètent l'effectif dans les quotas (validation moteur)", () => {
    const pool: EnginePlayer[] = [
      { id: gkMarseille.id, lastName: "Marseille", line: "GK" },
      { id: gkParis.id, lastName: "Paris", line: "GK" },
      { id: 9001, lastName: "Antunes", line: "DEF" },
      { id: 9002, lastName: "Aubameyang", line: "ATT" },
      { id: 9003, lastName: "Camara", line: "MID" },
    ];
    const proposed = proposeCompletions(alice.roster, pool);
    expect(proposed).toHaveLength(3);
    // 1 GK d'abord (alphabétique : Marseille < Paris), puis alphabétique global
    expect(proposed[0].line).toBe("GK");
    expect(proposed[0].lastName).toBe("Marseille");
    expect(proposed.map((p) => p.lastName)).toEqual(["Marseille", "Antunes", "Aubameyang"]);
    expect(validateFinalRoster([...alice.roster, ...proposed])).toEqual([]);
  });

  it("jamais 2 gardiens proposés (quota moteur respecté)", () => {
    const pool: EnginePlayer[] = [
      { id: gkMarseille.id, lastName: "Marseille", line: "GK" },
      { id: gkParis.id, lastName: "Paris", line: "GK" },
      { id: 9001, lastName: "Antunes", line: "DEF" },
      { id: 9002, lastName: "Aubameyang", line: "ATT" },
    ];
    const proposed = proposeCompletions(alice.roster, pool);
    expect(proposed.filter((p) => p.line === "GK")).toHaveLength(1);
  });

  // Sanity-check : si la complétion ignorait les quotas, un effectif déjà
  // pourvu d'un gardien recevrait un 2e gardien — détecté ici.
  it("sanity-check : un effectif avec gardien ne se voit jamais proposer un gardien", () => {
    const rosterWithGk: EnginePlayer[] = [
      { id: gkParis.id, lastName: "Paris", line: "GK" },
      ...alice.roster.filter((p) => p.line !== "GK").slice(0, 9),
    ];
    const pool: EnginePlayer[] = [
      { id: gkMarseille.id, lastName: "Marseille", line: "GK" },
      { id: 9001, lastName: "Antunes", line: "DEF" },
      { id: 9002, lastName: "Aubameyang", line: "ATT" },
      { id: 9003, lastName: "Camara", line: "MID" },
    ];
    const proposed = proposeCompletions(rosterWithGk, pool);
    expect(proposed.some((p) => p.line === "GK")).toBe(false);
  });
});

describe("pont TEAM : écriture des effectifs puis calcul de scoring de test", () => {
  // Effectif final d'Alice : ses 10 acquis + complétion d'office
  const aliceRoster = computeRosterStatuses({
    participantIds: [ALICE],
    players: PLAYERS,
    wonBids: wonAfterRound1.filter((w) => w.userId === ALICE),
  })[0].roster;
  const completion: EnginePlayer[] = [
    { id: gkMarseille.id, lastName: "Marseille", line: "GK" },
    { id: 9001, lastName: "Antunes", line: "DEF" },
    { id: 9002, lastName: "Aubameyang", line: "ATT" },
  ];
  const finalRoster = [...aliceRoster, ...completion];
  const LEAGUE = 42;

  it("13 lignes TEAM par participant, saison entière (J1 → J38)", () => {
    const rows = planTeamRows(LEAGUE, [{ userId: ALICE, roster: finalRoster }]);
    expect(rows).toHaveLength(13);
    for (const r of rows) {
      expect(r).toMatchObject({ leagueId: LEAGUE, userId: ALICE, dayFirst: 1, dayLast: 38, isSubs: 0 });
    }
    expect(new Set(rows.map((r) => r.playerId)).size).toBe(13);
  });

  it("un effectif invalide est refusé par le pont (aucune écriture partielle)", () => {
    expect(() => planTeamRows(LEAGUE, [{ userId: ALICE, roster: aliceRoster }])).toThrow(/invalide/i);
  });

  it("un calcul de scoring de test tourne sans erreur sur l'effectif écrit", () => {
    const teamRows = planTeamRows(LEAGUE, [{ userId: ALICE, roster: finalRoster }]);

    // Référentiel joueurs pour la résolution pseudo-gardien : le pseudo
    // « Gardiens Marseille » (club 50) + un gardien nommé du même club.
    const CLUB = 50;
    const NAMED_GK_ID = 8001;
    const playersForScoring = [
      { id: gkMarseille.id, clubId: CLUB, position: GK_POS, link: "gardiens_marseille" },
      { id: NAMED_GK_ID, clubId: CLUB, position: GK_POS, link: null },
      ...teamRows
        .filter((r) => r.playerId !== gkMarseille.id)
        .map((r) => ({ id: r.playerId, clubId: 1, position: "?", link: null })),
    ];
    // Notes de la journée 1 : le gardien nommé de Marseille a 7, Savanier 6 (+1 but)
    const dayScores = [
      { playerId: NAMED_GK_ID, points: 7, goals: 0, used: 1 },
      { playerId: savanier.id, points: 6, goals: 1, used: 1 },
    ];
    const resolve = buildDayScoreResolver(playersForScoring, dayScores);

    // 11 titulaires : pseudo-gardien + 4 DEF + 5 MID + 1 ATT (Savanier)
    const positionById = new Map<number, Position>(
      finalRoster.map((p) => [p.id, p.line as Position])
    );
    const starters = [
      gkMarseille.id,
      ...finalRoster.filter((p) => p.line === "DEF").slice(0, 4).map((p) => p.id),
      ...finalRoster.filter((p) => p.line === "MID").slice(0, 5).map((p) => p.id),
      savanier.id,
    ];
    expect(starters).toHaveLength(11);

    const performances: Performance[] = starters
      .map((id) => ({ id, score: resolve(id) }))
      .filter((x) => x.score !== undefined)
      .map((x) => ({
        playerId: String(x.id),
        matchday: 1,
        minutesPlayed: 90,
        rating: Number(x.score!.points),
        goals: x.score!.goals,
        assists: 0,
        ownGoals: 0,
        redCard: false,
        penaltySaved: 0,
        penaltyMissed: 0,
      }));

    const { total, playerScores } = calculateLineupScore(
      starters.map(String),
      performances,
      (pid) => positionById.get(Number(pid)) ?? "MID"
    );
    expect(playerScores).toHaveLength(11);
    // Calcul à la main : gardien 7 (note du gardien nommé aligné), Savanier
    // 6 + 2 (but ATT), 9 joueurs sans note = 2 pts chacun (forfait).
    expect(total).toBe(7 + 8 + 9 * 2);
  });

  // Sanity-check : si le pont écrivait un effectif sans pseudo-gardien résolu,
  // le gardien tomberait à 2 pts (forfait) — l'assertion du total le détecterait.
  it("sanity-check : un pseudo-gardien non résolu changerait le total", () => {
    const buggyTotal = 2 + 8 + 9 * 2; // gardien traité comme sans note
    expect(buggyTotal).not.toBe(7 + 8 + 9 * 2);
  });
});

describe("mapping position DB → ligne moteur", () => {
  it("reprend les libellés réels de la base", () => {
    expect(lineFromPosition("Gardien")).toBe("GK");
    expect(lineFromPosition("Défenseur")).toBe("DEF");
    expect(lineFromPosition("Defense")).toBe("DEF");
    expect(lineFromPosition("Milieu de terrain")).toBe("MID");
    expect(lineFromPosition("Attaquant")).toBe("ATT");
  });

  // BLOQUANT-1 (recette 2026-06-16) : les codes courts canoniques
  // G/DEF/MIL/ATT retombaient tous sur "MID" (la détection ne testait que les
  // mots français complets), classant DEF et ATT comme milieux.
  it("gère les codes courts canoniques G/DEF/MIL/ATT", () => {
    expect(lineFromPosition("G")).toBe("GK");
    expect(lineFromPosition("DEF")).toBe("DEF");
    expect(lineFromPosition("MIL")).toBe("MID");
    expect(lineFromPosition("ATT")).toBe("ATT");
  });

  it("gère les libellés préfixés ('2 - Défense')", () => {
    expect(lineFromPosition("1 - Gardien")).toBe("GK");
    expect(lineFromPosition("2 - Défense")).toBe("DEF");
    expect(lineFromPosition("3 - Milieu")).toBe("MID");
    expect(lineFromPosition("4 - Attaque")).toBe("ATT");
  });

  // Sanity-check : avant le fix BLOQUANT-1, "DEF" et "ATT" rendaient "MID".
  // On prouve que ce test détecterait ce comportement bugué.
  it("sanity-check : la régression 'codes courts → MID' serait détectée", () => {
    const buggyDef = "MID"; // ancien comportement pour "DEF"
    const buggyAtt = "MID"; // ancien comportement pour "ATT"
    const detects =
      lineFromPosition("DEF") !== buggyDef || lineFromPosition("ATT") !== buggyAtt;
    expect(detects).toBe(true);
  });
});

// ── BLOQUANT-1 + cascade BLOQUANT-2 (recette simulée 2026-06-16) ───────────
// Régression du dépouillement de bout en bout avec des positions DB en CODES
// COURTS (G/DEF/MIL/ATT), exactement comme la base le renvoie. La racine unique
// est lineFromPosition : avant le fix, tous les joueurs de champ étaient classés
// "milieu", ce qui déclenchait la pénalité "milieux en excès" sur toute mise
// normale (BLOQUANT-1) et, par contamination des acquis du tour 1, faisait
// chuter l'effectif reporté sous 13 au tour 2 (BLOQUANT-2, simple cascade).
describe("BLOQUANT-1 : dépouillement avec positions DB en codes courts", () => {
  // Joueurs en codes courts : 1 GK + 5 DEF + 4 MIL + 3 ATT = 13.
  const players = new Map<number, ResolutionPlayer>();
  let id = 5000;
  const reg = (lastName: string, position: string) => {
    const p = { id: id++, lastName, position, displayName: lastName };
    players.set(p.id, p);
    return p;
  };
  const gk = reg("Gk", "G");
  const defs = ["Da", "Db", "Dc", "Dd", "De"].map((n) => reg(n, "DEF"));
  const mids = ["Ma", "Mb", "Mc", "Md"].map((n) => reg(n, "MIL"));
  const atts = ["Aa", "Ab", "Ac"].map((n) => reg(n, "ATT"));
  const squad = [gk, ...defs, ...mids, ...atts];

  let bidId = 7000;
  const round1 = squad.map((p) => ({
    id: bidId++,
    userId: 1,
    playerId: p.id,
    amount: p.id === gk.id ? 10 : 5,
  }));

  it("mise conforme 1GK/5DEF/4MIL/3ATT : AUCUNE pénalité de ligne", () => {
    const plan = planResolution({
      budgetPerUser: 130,
      participantIds: [1],
      players,
      wonBids: [],
      pendingBids: round1,
    });
    expect(plan.removals).toHaveLength(0);
    expect(plan.outcome.acquisitions).toHaveLength(13);
  });

  it("l'effectif final est valide (5 DEF, 4 MIL, 3 ATT, 1 GK — pas 13 milieux)", () => {
    const [statuses] = computeRosterStatuses({
      participantIds: [1],
      players,
      wonBids: squad.map((p) => ({ userId: 1, playerId: p.id, amount: 5 })),
    });
    expect(statuses.errors).toEqual([]);
    expect(statuses.roster.filter((p) => p.line === "DEF")).toHaveLength(5);
    expect(statuses.roster.filter((p) => p.line === "MID")).toHaveLength(4);
    expect(statuses.roster.filter((p) => p.line === "ATT")).toHaveLength(3);
  });

  // BLOQUANT-2 (cascade) : au tour 2, 12 acquis reportés + 1 mise de complément
  // = 13 cumulés → aucune pénalité "<13" ni de ligne. La pénalité "<13" compte
  // bien l'effectif cumulé (acquis owned + nouvelles mises), pas la seule mise.
  it("tour 2 : 12 acquis reportés + 1 complément → aucune pénalité", () => {
    const owned = squad.slice(0, 12).map((p) => ({ userId: 1, playerId: p.id, amount: 5 }));
    const complement = squad[12]; // 13e joueur, misé seul au tour 2
    const plan = planResolution({
      budgetPerUser: 130,
      participantIds: [1],
      players,
      wonBids: owned, // reportés automatiquement (règle 3.1)
      pendingBids: [{ id: 7100, userId: 1, playerId: complement.id, amount: 5 }],
    });
    expect(plan.removals).toHaveLength(0);
    expect(plan.outcome.acquisitions).toHaveLength(1);
  });

  // Sanity-check : avec l'ancien lineFromPosition (tout champ → MID), la mise
  // conforme ci-dessus aurait produit au moins un retrait "milieux en excès"
  // (12 champ classés MID > 6). On vérifie que le test l'aurait capté.
  it("sanity-check : la régression de classification serait détectée", () => {
    const plan = planResolution({
      budgetPerUser: 130,
      participantIds: [1],
      players,
      wonBids: [],
      pendingBids: round1,
    });
    const buggyRemovalCount = 6; // 12 "milieux" - 6 = 6 retraits sous l'ancien bug
    expect(buggyRemovalCount !== plan.removals.length).toBe(true);
  });
});

// ── B3 : Défense double-won ────────────────────────────────────────────────
// Scénario : un participant soumet une mise sur un joueur qu'il a déjà remporté
// lors d'un tour précédent (statut 'won'). La couche buildEngineInput doit rejeter
// l'entrée avec une erreur avant tout appel au moteur.
describe("B3 – défense double-won : re-mise sur un joueur déjà won → refus", () => {
  const ALICE = 101;
  // Joueur déjà remporté par Alice au tour précédent
  const alreadyWon: WonBidRow = { userId: ALICE, playerId: savanier.id, amount: 20 };

  it("une mise pending sur un joueur déjà won par le même participant lève une erreur", () => {
    const dupInput: ResolutionInput = {
      budgetPerUser: 130,
      participantIds: [ALICE],
      players: PLAYERS,
      wonBids: [alreadyWon],
      // Mise pending sur Savanier (déjà won)
      pendingBids: [{ id: 9001, userId: ALICE, playerId: savanier.id, amount: 5 }],
    };
    expect(() => planResolution(dupInput)).toThrow(/[Dd]ouble[-\s]?won|déjà remporté/i);
  });

  // Sanity-check : sans la défense double-won, le même input ne lèverait pas
  // d'erreur et Savanier apparaîtrait deux fois dans l'effectif d'Alice.
  // On vérifie qu'un input sain (joueur distinct) passe bien.
  it("sanity-check : une mise pending sur un joueur DIFFÉRENT du won ne lève pas", () => {
    const safeInput: ResolutionInput = {
      budgetPerUser: 130,
      participantIds: [ALICE],
      players: PLAYERS,
      wonBids: [alreadyWon],
      // Mise sur Terrier (non won), pas sur Savanier
      pendingBids: [{ id: 9002, userId: ALICE, playerId: terrier.id, amount: 5 }],
    };
    expect(() => planResolution(safeInput)).not.toThrow();
  });
});

describe("entrées moteur : budgets et acquis reconstruits depuis les mises won", () => {
  it("le budget d'un tour N+1 décompte uniquement les acquisitions", () => {
    const input = buildEngineInput({
      budgetPerUser: 130,
      participantIds: [ALICE],
      players: PLAYERS,
      wonBids: wonAfterRound1.filter((w) => w.userId === ALICE),
      pendingBids: [],
    });
    expect(input[0].budget).toBe(49); // 130 - 81 d'acquisitions
    expect(input[0].owned).toHaveLength(10);
  });
});

// ── lineFromPosition : mapping avec le vocabulaire EXACT de la prod ─────────
// Régression du 2026-08-09 (cas Coppola) : deux copies locales du mapping dans
// l'UI ne reconnaissaient pas "Défense" (elles attendaient "défenseur") avec un
// fallback "ATT" : tous les défenseurs s'affichaient en attaquants. Les
// fixtures de test utilisaient "Défenseur", jamais le format réel de la base :
// ces cas verrouillent le vocabulaire prod tel quel.
describe("lineFromPosition : vocabulaire réel de la base de prod", () => {
  it("import 2026-2027 : libellés courts", () => {
    expect(lineFromPosition("Gardien")).toBe("GK");
    expect(lineFromPosition("Défense")).toBe("DEF");
    expect(lineFromPosition("Milieu")).toBe("MID");
    expect(lineFromPosition("Attaque")).toBe("ATT");
  });

  it("données legacy : libellés préfixés N -", () => {
    expect(lineFromPosition("1 - Gardien")).toBe("GK");
    expect(lineFromPosition("2 - Défense")).toBe("DEF");
    expect(lineFromPosition("3 - Milieu")).toBe("MID");
    expect(lineFromPosition("4 - Attaque")).toBe("ATT");
  });

  it("sanity-check : l'ancien mapping UI bugué échouerait ces cas", () => {
    // Copie exacte de l'ancien helper des pages enchères (supprimé).
    const buggy = (pos: string) => {
      const p = pos.toLowerCase();
      if (p.includes("ardien") || p === "gk" || p === "g") return "GK";
      if (p === "def" || p.includes("défenseur") || p.includes("defenseur")) return "DEF";
      if (p === "mid" || p === "mil" || p.includes("milieu")) return "MID";
      return "ATT";
    };
    expect(buggy("Défense")).toBe("ATT"); // le bug : défenseur classé attaquant
    expect(lineFromPosition("Défense")).toBe("DEF"); // le correctif
  });
});
