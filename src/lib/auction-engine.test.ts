/**
 * Contrat de tests du moteur d'enchères (règlement source : docs/regles-encheres.md).
 * Ces 7 cas constituent la gate CI : tout chantier qui casse le moteur
 * fait échouer `npm test` avant d'atteindre la PR.
 *
 * Convention : chaque describe inclut un "sanity-check" qui prouve que le
 * test détecterait la régression qu'il garde (simulation du comportement bugué,
 * passé au même détecteur, qui doit échouer). Cf. CLAUDE.md § contrat de tests.
 */

import { describe, it, expect } from "vitest";
import {
  resolveRound,
  acceptSubmission,
  validateSubmission,
  type ParticipantInput,
  type EnginePlayer,
  type Line,
} from "./auction-engine";
import { findDuplicatePlayerIds } from "./auction-duplicate-bids";

// ── Helpers ────────────────────────────────────────────────────────────────
let nextId = 1;
function player(lastName: string, line: Line): EnginePlayer {
  return { id: nextId++, lastName, line };
}

// Effectif valide de 13 joueurs (1 GK, 4 DEF, 5 MID, 3 ATT).
// Les noms sont préfixés pour rester uniques par participant.
function validSquad(prefix: string): EnginePlayer[] {
  return [
    player(`${prefix}-gk`, "GK"),
    ...["d1", "d2", "d3", "d4"].map((n) => player(`${prefix}-${n}`, "DEF")),
    ...["m1", "m2", "m3", "m4", "m5"].map((n) => player(`${prefix}-${n}`, "MID")),
    ...["a1", "a2", "a3"].map((n) => player(`${prefix}-${n}`, "ATT")),
  ];
}

// ── Cas 1 : égalité de mise (règle 3.2.a) ─────────────────────────────────
describe("égalité de mise : personne n'obtient le joueur", () => {
  const mbappe = player("Mbappe", "ATT");

  function makeRound(): ParticipantInput[] {
    const mkBids = (prefix: string) => {
      const squad = validSquad(prefix);
      // 12 joueurs propres + Mbappé pour garder 13 joueurs valides.
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

  it("Mbappé n'est attribué à personne", () => {
    expect(outcome.acquisitions.some((a) => a.player.id === mbappe.id)).toBe(false);
  });

  it("l'égalité est tracée avec les 2 participants", () => {
    const tie = outcome.ties.find((t) => t.playerId === mbappe.id);
    expect(tie?.userIds.sort()).toEqual([1, 2]);
  });

  it("budget participant 1 après tour (130 - 60 pts, Mbappé non décompté)", () => {
    expect(outcome.budgetsAfter.get(1)).toBe(70);
  });

  it("budget participant 2 après tour (130 - 60 pts, Mbappé non décompté)", () => {
    expect(outcome.budgetsAfter.get(2)).toBe(70);
  });

  // Sanity-check : "attribué au premier arrivé" serait détecté.
  it("sanity-check : régression 'premier arrivé' serait détectée", () => {
    const buggyAcquired = true;
    const buggyBudget1 = 130 - 60 - 50;
    const detects =
      buggyAcquired !== outcome.acquisitions.some((a) => a.player.id === mbappe.id) ||
      buggyBudget1 !== outcome.budgetsAfter.get(1);
    expect(detects).toBe(true);
  });
});

// ── Cas 2 : mise sans gardien (règle 3.2.c) ───────────────────────────────
describe("mise sans gardien : retrait d'1 joueur sur la plus chère (alphabétique)", () => {
  // 13 joueurs SANS gardien : 5 DEF, 5 MID, 3 ATT.
  // Deux joueurs à 30 pts -> l'alphabétique ("Aubert" avant "Zidane") est retiré.
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
        amount: p.lastName === "Zidane" || p.lastName === "Aubert" ? 30 : 5,
      })),
    },
  ];

  const outcome = resolveRound(participants);

  it("1 retrait appliqué", () => {
    expect(outcome.removals.length).toBe(1);
  });

  it("motif = absence de gardien", () => {
    expect(outcome.removals[0]?.reason).toBe("Absence de gardien dans la mise");
  });

  it("le retrait porte sur Aubert (plus chère alphabétique, ex æquo avec Zidane)", () => {
    expect(outcome.removals[0]?.player.lastName).toBe("Aubert");
  });

  it("Aubert n'est plus dans les acquisitions", () => {
    expect(outcome.acquisitions.some((a) => a.player.lastName === "Aubert")).toBe(false);
  });

  it("Zidane reste acquis", () => {
    expect(outcome.acquisitions.some((a) => a.player.lastName === "Zidane")).toBe(true);
  });

  it("budget après tour (130 - 85)", () => {
    // 13 mises = 11x5 + 2x30 = 115 ; acquis final = 115 - 30 (Aubert) = 85
    expect(outcome.budgetsAfter.get(1)).toBe(45);
  });

  // Sanity-check : "aucune pénalité sans gardien" donnerait 0 retrait.
  it("sanity-check : régression 'pas de pénalité sans gardien' serait détectée", () => {
    const buggyRemovals = 0;
    const buggyBudget = 15;
    const detects =
      buggyRemovals !== outcome.removals.length ||
      buggyBudget !== outcome.budgetsAfter.get(1);
    expect(detects).toBe(true);
  });
});

// ── Cas 3 : dépassement de budget (règle 3.2.c) ───────────────────────────
describe("dépassement de budget : retrait d'1 joueur (la plus grosse acquisition)", () => {
  const squad = validSquad("u1b");
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
  const outcome = resolveRound(participants);

  it("précondition : la mise totalise bien 131", () => {
    expect(total).toBe(131);
  });

  it("1 retrait appliqué", () => {
    expect(outcome.removals.length).toBe(1);
  });

  it("motif = dépassement de budget", () => {
    expect(outcome.removals[0]?.reason).toBe("Total des mises supérieur au budget disponible");
  });

  it("le retrait porte sur la plus grosse acquisition (le gardien à 23)", () => {
    expect(outcome.removals[0]?.amount).toBe(23);
  });

  it("12 acquisitions restantes", () => {
    expect(outcome.acquisitions.length).toBe(12);
  });

  it("budget après tour (130 - 108)", () => {
    expect(outcome.budgetsAfter.get(1)).toBe(22);
  });

  // Sanity-check : "dépassement accepté sans pénalité" = 13 acquis + budget négatif.
  it("sanity-check : régression 'budget dépassé toléré' serait détectée", () => {
    const buggyAcquisitions = 13;
    const buggyBudget = -1;
    const detects =
      buggyAcquisitions !== outcome.acquisitions.length ||
      buggyBudget !== outcome.budgetsAfter.get(1);
    expect(detects).toBe(true);
  });
});

// ── Cas 4 : excès d'attaquants (règle 3.2.c) ──────────────────────────────
describe("excès d'attaquants : retrait dans la ligne ATT uniquement", () => {
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
        // Ae est le plus cher ATT (25). Da a 20 pour tester que le retrait reste ATT.
        ...atts.map((p, i) => ({ player: p, amount: i === 4 ? 25 : 8 })),
      ],
    },
  ];
  // Da à 20
  participants[0].bids.find((b) => b.player.lastName === "Da")!.amount = 20;

  const outcome = resolveRound(participants);

  it("1 retrait appliqué", () => {
    expect(outcome.removals.length).toBe(1);
  });

  it("motif = attaquants en excès", () => {
    expect(outcome.removals[0]?.reason).toBe("Attaquants en excès dans la mise");
  });

  it("le retrait est un attaquant (pas le DEF à 20)", () => {
    expect(outcome.removals[0]?.player.line).toBe("ATT");
  });

  it("c'est l'attaquant le plus cher (Ae à 25)", () => {
    expect(outcome.removals[0]?.player.lastName).toBe("Ae");
  });

  it("le défenseur Da à 20 reste acquis", () => {
    expect(outcome.acquisitions.some((a) => a.player.lastName === "Da")).toBe(true);
  });

  it("4 attaquants restants après retrait", () => {
    expect(outcome.acquisitions.filter((a) => a.player.line === "ATT").length).toBe(4);
  });

  // Sanity-check : même avec un DEF plus cher que tous les ATT, le retrait reste dans ATT.
  it("sanity-check : retrait dans la ligne même si un DEF est plus cher (Av à 15 retiré pas Dx à 20)", () => {
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
    expect(outcome2.removals[0]?.player.lastName).toBe("Av");
    expect(outcome2.acquisitions.some((a) => a.player.lastName === "Dx")).toBe(true);
  });
});

// ── Cas 5 : report des points non utilisés (règle 3.2.b) ──────────────────
describe("report des points : mises perdues récupérées au tour suivant", () => {
  const mbappe5 = player("Mbappe", "ATT");
  const squad1 = validSquad("u1c").slice(0, 12); // 1 GK, 4 DEF, 5 MID, 2 ATT
  const amounts = [13, 7, 7, 7, 7, 6, 6, 6, 6, 5, 5, 5]; // total 80

  const participant1: ParticipantInput = {
    userId: 1,
    budget: 130,
    owned: [],
    bids: [
      ...squad1.map((p, i) => ({ player: p, amount: amounts[i] })),
      { player: mbappe5, amount: 50 },
    ],
  };
  const participant2: ParticipantInput = {
    userId: 2,
    budget: 130,
    owned: [],
    bids: [
      ...validSquad("u2c").slice(0, 12).map((p) => ({ player: p, amount: 5 })),
      { player: mbappe5, amount: 60 },
    ],
  };

  it("précondition : participant 1 mise bien 130", () => {
    expect(participant1.bids.reduce((s, b) => s + b.amount, 0)).toBe(130);
  });

  const outcome = resolveRound([participant1, participant2]);

  it("participant 1 perd Mbappé", () => {
    expect(outcome.lostBids.some((l) => l.userId === 1 && l.playerId === mbappe5.id)).toBe(true);
  });

  it("participant 1 obtient ses 12 autres joueurs", () => {
    expect(outcome.acquisitions.filter((a) => a.userId === 1).length).toBe(12);
  });

  it("budget participant 1 au tour 2 = 50 (50 pts perdus rendus)", () => {
    expect(outcome.budgetsAfter.get(1)).toBe(50);
  });

  it("budget participant 2 au tour 2 = 10 (130 - 60 pour Mbappé - 60 pour son propre squad)", () => {
    expect(outcome.budgetsAfter.get(2)).toBe(10);
  });

  // Sanity-check : "mises perdues non rendues" donnerait 0 pour participant 1.
  it("sanity-check : régression 'mises perdues non rendues' serait détectée", () => {
    const buggyBudget = 130 - 130;
    expect(buggyBudget !== outcome.budgetsAfter.get(1)).toBe(true);
  });
});

// ── Cas 6 : retrait insuffisant, pas de dette (règle 3.2.c.4) ─────────────
describe("retrait insuffisant : pénalité bornée aux acquisitions réelles, pas de dette", () => {
  // Participant 1 : 11 joueurs misés (2 manquants -> pénalité 2).
  // Participant 2 surenchérit sur 10 des 11 : participant 1 n'en obtient qu'1.
  const p1Squad = [
    player("Gardien6", "GK"),
    ...["Da6", "Db6", "Dc6", "Dd6"].map((n) => player(n, "DEF")),
    ...["Ma6", "Mb6", "Mc6", "Md6"].map((n) => player(n, "MID")),
    ...["Aa6", "Ab6"].map((n) => player(n, "ATT")),
  ];
  const sniped = p1Squad.filter((p) => p.lastName !== "Md6");

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
        { player: player("Mx6", "MID"), amount: 5 },
        { player: player("My6", "MID"), amount: 5 },
        { player: player("Ax6", "ATT"), amount: 5 },
      ],
    },
  ];

  const outcome = resolveRound(participants);
  const p1Acquisitions = outcome.acquisitions.filter((a) => a.userId === 1);
  const p1Removals = outcome.removals.filter((r) => r.userId === 1);

  it("participant 1 n'a gagné qu'1 joueur avant pénalité (le reste sniped)", () => {
    expect(p1Acquisitions.length + p1Removals.length).toBe(1);
  });

  it("1 seul retrait appliqué (pas 2 : pas de dette)", () => {
    expect(p1Removals.length).toBe(1);
  });

  it("motif = moins de 13 joueurs misés", () => {
    expect(p1Removals[0]?.reason).toBe("Moins de 13 joueurs misés");
  });

  it("participant 1 finit le tour avec 0 acquisition", () => {
    expect(p1Acquisitions.length).toBe(0);
  });

  it("budget participant 1 intact (tout est rendu)", () => {
    expect(outcome.budgetsAfter.get(1)).toBe(130);
  });

  it("budget jamais négatif, aucune dette", () => {
    expect((outcome.budgetsAfter.get(1) ?? 0) >= 0).toBe(true);
  });

  // Sanity-check : "dette portée" = budget < 130 ou compteur à 2.
  it("sanity-check : régression 'dette portée' serait détectée", () => {
    const buggyRemovalCount = 2;
    expect(buggyRemovalCount !== p1Removals.length).toBe(true);
  });
});

// ── Cas 7 : deadline, tolérance zéro (règle 3.1 + amendement 2026-06-10) ──
describe("deadline : tolérance zéro, tour fermé = rejet", () => {
  const deadline = new Date("2026-07-15T18:00:00.000Z");

  it("soumission avant deadline acceptée", () => {
    expect(
      acceptSubmission({
        roundOpen: true,
        deadline,
        submittedAt: new Date("2026-07-15T17:59:59.000Z"),
      }).accepted
    ).toBe(true);
  });

  it("soumission à la seconde exacte de la deadline acceptée", () => {
    expect(
      acceptSubmission({ roundOpen: true, deadline, submittedAt: deadline }).accepted
    ).toBe(true);
  });

  it("soumission 1s après deadline REJETÉE", () => {
    expect(
      acceptSubmission({
        roundOpen: true,
        deadline,
        submittedAt: new Date("2026-07-15T18:00:01.000Z"),
      }).accepted
    ).toBe(false);
  });

  it("motif explicite pour soumission en retard", () => {
    const result = acceptSubmission({
      roundOpen: true,
      deadline,
      submittedAt: new Date("2026-07-15T18:00:01.000Z"),
    });
    expect(result.reason).toBe("Soumission après l'heure butoir");
  });

  it("tour fermé (clôture admin) = rejet même sans deadline", () => {
    expect(
      acceptSubmission({
        roundOpen: false,
        deadline: null,
        submittedAt: new Date("2026-07-15T12:00:00.000Z"),
      }).accepted
    ).toBe(false);
  });

  it("tour ouvert sans deadline = accepté (fermeture manuelle fait foi)", () => {
    expect(
      acceptSubmission({
        roundOpen: true,
        deadline: null,
        submittedAt: new Date("2026-07-15T23:59:59.000Z"),
      }).accepted
    ).toBe(true);
  });

  // Sanity-check : une "période de grâce" aurait accepté T+1s.
  it("sanity-check : régression 'période de grâce' serait détectée", () => {
    const late = acceptSubmission({
      roundOpen: true,
      deadline,
      submittedAt: new Date("2026-07-15T18:00:01.000Z"),
    });
    const buggyAccepted = true;
    expect(buggyAccepted !== late.accepted).toBe(true);
  });
});

// ── Cas 8 : validateSubmission — avertissements de composition (BRIEF-04) ──
// Ces contrôles sont rejoués côté client (avertissements UI) et référencés
// côté serveur pour auditing. Ils sont non bloquants à la soumission (le
// règlement pénalise au dépouillement, 3.2.c). Ces tests garantissent que
// le moteur génère les bons messages avant qu'un participant soumette.
describe("validateSubmission : avertissements de composition (BRIEF-04)", () => {
  function p(lastName: string, line: Line): EnginePlayer {
    return { id: nextId++, lastName, line };
  }

  it("mise conforme 13 joueurs : aucun avertissement", () => {
    const owned: EnginePlayer[] = [
      p("Gk", "GK"),
      p("D1", "DEF"), p("D2", "DEF"), p("D3", "DEF"),
      p("M1", "MID"), p("M2", "MID"), p("M3", "MID"),
    ];
    const bids = [
      { player: p("D4", "DEF"), amount: 5 },
      { player: p("M4", "MID"), amount: 5 },
      { player: p("A1", "ATT"), amount: 5 },
      { player: p("A2", "ATT"), amount: 5 },
      { player: p("A3", "ATT"), amount: 5 },
      { player: p("A4", "ATT"), amount: 5 },
    ];
    const warnings = validateSubmission(owned, bids, 130);
    expect(warnings).toHaveLength(0);
  });

  it("aucun gardien dans la mise : avertissement retrait d'1 joueur", () => {
    const owned: EnginePlayer[] = [
      p("D1", "DEF"), p("D2", "DEF"), p("D3", "DEF"),
      p("M1", "MID"), p("M2", "MID"), p("M3", "MID"),
    ];
    const bids = [
      { player: p("D4", "DEF"), amount: 5 },
      { player: p("M4", "MID"), amount: 5 },
      { player: p("A1", "ATT"), amount: 5 },
      { player: p("A2", "ATT"), amount: 5 },
      { player: p("A3", "ATT"), amount: 5 },
      { player: p("A4", "ATT"), amount: 5 },
      { player: p("A5", "ATT"), amount: 5 },
    ];
    const warnings = validateSubmission(owned, bids, 130);
    expect(warnings.some((w) => w.includes("gardien"))).toBe(true);
  });

  it("7 défenseurs : avertissement excès DEF", () => {
    const owned: EnginePlayer[] = [
      p("Gk", "GK"),
      p("D1", "DEF"), p("D2", "DEF"), p("D3", "DEF"), p("D4", "DEF"),
      p("M1", "MID"), p("M2", "MID"),
    ];
    const bids = [
      { player: p("D5", "DEF"), amount: 5 },
      { player: p("D6", "DEF"), amount: 5 },
      { player: p("D7", "DEF"), amount: 5 }, // 7e défenseur
      { player: p("M3", "MID"), amount: 5 },
      { player: p("A1", "ATT"), amount: 5 },
      { player: p("A2", "ATT"), amount: 5 },
    ];
    const warnings = validateSubmission(owned, bids, 130);
    expect(warnings.some((w) => w.includes("défenseurs"))).toBe(true);
  });

  it("5 attaquants : avertissement excès ATT", () => {
    const owned: EnginePlayer[] = [
      p("Gk", "GK"),
      p("D1", "DEF"), p("D2", "DEF"), p("D3", "DEF"),
      p("M1", "MID"), p("M2", "MID"), p("M3", "MID"),
    ];
    const bids = [
      { player: p("A1", "ATT"), amount: 5 },
      { player: p("A2", "ATT"), amount: 5 },
      { player: p("A3", "ATT"), amount: 5 },
      { player: p("A4", "ATT"), amount: 5 },
      { player: p("A5", "ATT"), amount: 5 }, // 5e attaquant
    ];
    const warnings = validateSubmission(owned, bids, 130);
    expect(warnings.some((w) => w.includes("attaquants"))).toBe(true);
  });

  it("moins de 13 joueurs : avertissement joueurs manquants", () => {
    const owned: EnginePlayer[] = [
      p("Gk", "GK"),
      p("D1", "DEF"), p("D2", "DEF"), p("D3", "DEF"),
    ];
    const bids = [
      { player: p("M1", "MID"), amount: 5 },
      { player: p("M2", "MID"), amount: 5 },
      // seulement 6 joueurs, manque 7
    ];
    const warnings = validateSubmission(owned, bids, 130);
    expect(warnings.some((w) => w.includes("6") && w.includes("13"))).toBe(true);
  });

  it("total mises > budget : avertissement dépassement", () => {
    const owned: EnginePlayer[] = [
      p("Gk", "GK"),
      p("D1", "DEF"), p("D2", "DEF"), p("D3", "DEF"),
      p("M1", "MID"), p("M2", "MID"), p("M3", "MID"),
    ];
    const bids = [
      { player: p("D4", "DEF"), amount: 30 },
      { player: p("M4", "MID"), amount: 30 },
      { player: p("A1", "ATT"), amount: 30 },
      { player: p("A2", "ATT"), amount: 30 },
      { player: p("A3", "ATT"), amount: 30 },
      { player: p("A4", "ATT"), amount: 30 }, // total 180 > budget 50
    ];
    const warnings = validateSubmission(owned, bids, 50);
    expect(warnings.some((w) => w.includes("budget"))).toBe(true);
  });

  // Sanity-check : si validateSubmission retournait toujours [], les tests
  // ci-dessus échoueraient (length !== 0 serait faux).
  it("sanity-check : validateSubmission vide ne satisfait pas les cas d'erreur", () => {
    // Mise invalide (pas de gardien, 1 seul joueur)
    const owned: EnginePlayer[] = [];
    const bids = [{ player: p("X", "DEF"), amount: 5 }];
    const warnings = validateSubmission(owned, bids, 130);
    // On s'attend à au moins 2 avertissements (pas de gardien + < 13 joueurs)
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Garde B3 : playerId en doublon dans une soumission ───────────────────────
describe("doublon de playerId : soumission malformée rejetée", () => {
  it("deux mises sur le même playerId : doublon détecté", () => {
    // Cas observé en recette : bids [{12402,10},{12402,20}] tous deux persistés.
    const bids = [
      { playerId: 12402, amount: 10 },
      { playerId: 12402, amount: 20 },
    ];
    expect(findDuplicatePlayerIds(bids)).toEqual([12402]);
  });

  it("plusieurs doublons distincts : tous remontés une seule fois", () => {
    const bids = [
      { playerId: 1, amount: 5 },
      { playerId: 2, amount: 5 },
      { playerId: 1, amount: 7 },
      { playerId: 2, amount: 9 },
      { playerId: 2, amount: 3 },
    ];
    expect(findDuplicatePlayerIds(bids).sort((x, y) => x - y)).toEqual([1, 2]);
  });

  it("soumission saine : aucun doublon", () => {
    const bids = [
      { playerId: 1, amount: 5 },
      { playerId: 2, amount: 5 },
      { playerId: 3, amount: 5 },
    ];
    expect(findDuplicatePlayerIds(bids)).toEqual([]);
  });

  it("soumission vide : aucun doublon", () => {
    expect(findDuplicatePlayerIds([])).toEqual([]);
  });

  // Sanity-check : prouve que le test détecterait la régression qu'il garde.
  // Si findDuplicatePlayerIds retournait toujours [] (doublon non détecté,
  // comportement buggé d'origine), ce cas échouerait.
  it("sanity-check : le détecteur repère bien le doublon buggé d'origine", () => {
    const buggedPayload = [
      { playerId: 12402, amount: 10 },
      { playerId: 12402, amount: 20 },
    ];
    expect(findDuplicatePlayerIds(buggedPayload).length).toBeGreaterThan(0);
  });
});
