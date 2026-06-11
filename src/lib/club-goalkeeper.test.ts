// Tests de la résolution de note des pseudo-gardiens « Gardiens [Club] »
// (règle 2.1 + décision 2026-06-10, docs/regles-encheres.md §7).
// Données construites en mémoire, AUCUN accès DB.

import { describe, it, expect } from "vitest";
import {
  CLUB_GK_KEY_PREFIX,
  CLUB_GK_POSITION,
  clubGoalkeeperKey,
  isClubGoalkeeper,
  isNamedGoalkeeper,
  pickAlignedGoalkeeperScore,
  buildDayScoreResolver,
  expandIdsForGoalkeeperResolution,
  attributeClubGoalkeeperDayScores,
  type ClubGkPlayerLike,
} from "./club-goalkeeper";
import { validateFinalRoster, type EnginePlayer } from "./auction-engine";

// ── Données construites : club Marseille (id 10) ──────────────────────────
// 900 = pseudo-joueur « Gardiens Marseille »
// 901 = gardien titulaire (nommé), 902 = gardien remplaçant (nommé)
// 903 = défenseur du même club, 904 = gardien nommé d'un autre club (20)
const PSEUDO_GK: ClubGkPlayerLike = {
  id: 900,
  clubId: 10,
  position: CLUB_GK_POSITION,
  link: "gardiens_marseille",
};
const TITULAIRE: ClubGkPlayerLike = {
  id: 901,
  clubId: 10,
  position: "Gardien",
  link: "https://www.lequipe.fr/Football/FootballFicheJoueur901.html",
};
const REMPLACANT: ClubGkPlayerLike = {
  id: 902,
  clubId: 10,
  position: "Gardien",
  link: null,
};
const DEFENSEUR: ClubGkPlayerLike = {
  id: 903,
  clubId: 10,
  position: "Défenseur",
  link: null,
};
const AUTRE_GK: ClubGkPlayerLike = {
  id: 904,
  clubId: 20,
  position: "Gardien",
  link: null,
};
const PLAYERS = [PSEUDO_GK, TITULAIRE, REMPLACANT, DEFENSEUR, AUTRE_GK];

function score(playerId: number, points: number, extra: Partial<{ goals: number; day: number; used: number }> = {}) {
  return { playerId, points, goals: extra.goals ?? 0, day: extra.day ?? 1, used: extra.used };
}

describe("clé stable gardiens par club", () => {
  it("génère gardiens_<slug> (accents, espaces, tirets normalisés)", () => {
    expect(clubGoalkeeperKey("Marseille")).toBe("gardiens_marseille");
    expect(clubGoalkeeperKey("Saint-Étienne")).toBe("gardiens_saint_etienne");
    expect(clubGoalkeeperKey("Paris SG")).toBe("gardiens_paris_sg");
    expect(clubGoalkeeperKey("Le Havre AC")).toBe("gardiens_le_havre_ac");
  });

  it("distingue pseudo-gardien et gardien nommé", () => {
    expect(isClubGoalkeeper(PSEUDO_GK)).toBe(true);
    expect(isNamedGoalkeeper(PSEUDO_GK)).toBe(false);
    expect(isClubGoalkeeper(TITULAIRE)).toBe(false);
    expect(isNamedGoalkeeper(TITULAIRE)).toBe(true);
    expect(isNamedGoalkeeper(REMPLACANT)).toBe(true); // link NULL = nommé
    expect(isClubGoalkeeper(DEFENSEUR)).toBe(false);
    expect(isNamedGoalkeeper(DEFENSEUR)).toBe(false);
  });
});

describe("résolution de la note du pseudo-gardien (règle 2.1)", () => {
  it("gardien titulaire absent → la note du gardien aligné (remplaçant) est utilisée", () => {
    // Le titulaire (901) n'a PAS de ligne SCORE ce jour-là (absent).
    // Le remplaçant (902) a joué et a été noté 6.5.
    const dayScores = [score(902, 6.5), score(903, 5.0)];
    const resolve = buildDayScoreResolver(PLAYERS, dayScores);

    // Sanity-check anti-régression : sans la résolution, le pseudo-joueur
    // n'a aucune ligne SCORE à son id (un simple scoreMap.get raterait).
    expect(dayScores.some((s) => s.playerId === PSEUDO_GK.id)).toBe(false);

    const resolved = resolve(PSEUDO_GK.id);
    expect(resolved).toBeDefined();
    expect(resolved!.playerId).toBe(REMPLACANT.id);
    expect(Number(resolved!.points)).toBe(6.5);
  });

  it("titulaire présent → sa note est utilisée", () => {
    const resolve = buildDayScoreResolver(PLAYERS, [score(901, 7.0)]);
    expect(resolve(PSEUDO_GK.id)!.playerId).toBe(TITULAIRE.id);
  });

  it("aucun gardien du club noté → undefined (même comportement que sans note)", () => {
    // Seuls un défenseur du club et le gardien d'un AUTRE club sont notés.
    const resolve = buildDayScoreResolver(PLAYERS, [score(903, 6.0), score(904, 8.0)]);
    expect(resolve(PSEUDO_GK.id)).toBeUndefined();
  });

  it("deux gardiens du club notés le même jour → choix déterministe (meilleure note)", () => {
    const resolve = buildDayScoreResolver(PLAYERS, [score(901, 4.0), score(902, 6.0)]);
    expect(resolve(PSEUDO_GK.id)!.playerId).toBe(REMPLACANT.id);
    // Ordre des lignes indifférent (déterminisme).
    const resolve2 = buildDayScoreResolver(PLAYERS, [score(902, 6.0), score(901, 4.0)]);
    expect(resolve2(PSEUDO_GK.id)!.playerId).toBe(REMPLACANT.id);
  });

  it("égalité parfaite de note → plus petit ID (stable)", () => {
    const picked = pickAlignedGoalkeeperScore([score(902, 5.5), score(901, 5.5)]);
    expect(picked!.playerId).toBe(901);
  });

  it("les joueurs non pseudo gardent leur propre ligne (comportement inchangé)", () => {
    const resolve = buildDayScoreResolver(PLAYERS, [score(903, 5.0), score(901, 7.0)]);
    expect(resolve(DEFENSEUR.id)!.playerId).toBe(DEFENSEUR.id);
    expect(resolve(TITULAIRE.id)!.playerId).toBe(TITULAIRE.id);
    expect(resolve(99999)).toBeUndefined(); // joueur inconnu : pas de note
  });
});

describe("élargissement de la requête SCORE", () => {
  it("ajoute les gardiens nommés du club quand un pseudo-gardien est dans la compo", () => {
    const ids = expandIdsForGoalkeeperResolution([900, 903], PLAYERS);
    expect(ids).toContain(900);
    expect(ids).toContain(903);
    expect(ids).toContain(901);
    expect(ids).toContain(902);
    expect(ids).not.toContain(904); // gardien d'un autre club : inutile
  });

  it("sans pseudo-gardien dans la compo, liste inchangée", () => {
    expect(expandIdsForGoalkeeperResolution([903, 904], PLAYERS)).toEqual([903, 904]);
  });
});

describe("attribution multi-journées (stats cumulées)", () => {
  it("fabrique une ligne synthétique par journée où un gardien du club est noté", () => {
    const scores = [
      score(901, 7.0, { day: 1 }),
      score(902, 5.0, { day: 2, goals: 0 }), // titulaire absent J2
      score(903, 6.0, { day: 1 }),
      score(904, 8.0, { day: 1 }), // autre club : jamais attribué
    ];
    const synthetic = attributeClubGoalkeeperDayScores([900], PLAYERS, scores);
    expect(synthetic).toHaveLength(2);
    const j1 = synthetic.find((s) => s.day === 1)!;
    const j2 = synthetic.find((s) => s.day === 2)!;
    expect(j1.playerId).toBe(900);
    expect(Number(j1.points)).toBe(7.0);
    expect(j2.playerId).toBe(900);
    expect(Number(j2.points)).toBe(5.0);
    // Les lignes réelles ne sont pas modifiées.
    expect(scores.every((s) => s.playerId !== 900)).toBe(true);
  });
});

describe("flag used — préférence gardien aligné (finding m1)", () => {
  it("gardien non aligné used=0 avec meilleure note vs gardien aligné used=1 → le gardien aligné gagne", () => {
    // 901 = titulaire (used=0, note 9.0 — blessé en cours de match, noté mais
    //        sorti immédiatement, marqué used=0 par le système de saisie).
    // 902 = remplaçant entré (used=1, note 7.0 — a joué le match effectivement).
    // Sans le flag used, la meilleure note (9.0) l'emporterait, mais used=1
    // prime : on choisit parmi les lignes alignées d'abord.
    const rows = [
      score(901, 9.0, { used: 0 }),
      score(902, 7.0, { used: 1 }),
    ];
    const picked = pickAlignedGoalkeeperScore(rows);
    expect(picked!.playerId).toBe(902);
  });

  it("si aucune ligne used=1, comportement habituel (meilleure note)", () => {
    const rows = [
      score(901, 9.0, { used: 0 }),
      score(902, 7.0, { used: 0 }),
    ];
    const picked = pickAlignedGoalkeeperScore(rows);
    expect(picked!.playerId).toBe(901);
  });

  it("si toutes les lignes used=1, comportement habituel parmi elles (meilleure note)", () => {
    const rows = [
      score(901, 7.0, { used: 1 }),
      score(902, 9.0, { used: 1 }),
    ];
    const picked = pickAlignedGoalkeeperScore(rows);
    expect(picked!.playerId).toBe(902);
  });

  it("used absent (données legacy sans champ) → traité comme used=0, comportement inchangé", () => {
    // Score sans champ used : les deux lignes sont traitées comme used=0,
    // donc on choisit parmi tout l'ensemble → meilleure note gagne.
    const rows = [
      { playerId: 901, points: 9.0, goals: 0 }, // pas de champ used
      { playerId: 902, points: 7.0, goals: 0 },
    ];
    const picked = pickAlignedGoalkeeperScore(rows);
    expect(picked!.playerId).toBe(901);
  });
});

describe("isNamedGoalkeeper — helper B1", () => {
  it("gardien nommé avec lien externe = true", () => {
    expect(isNamedGoalkeeper({ position: "Gardien", link: "https://lequipe.fr/..." })).toBe(true);
  });

  it("gardien nommé avec link null = true", () => {
    expect(isNamedGoalkeeper({ position: "Gardien", link: null })).toBe(true);
  });

  it("pseudo-gardien avec prefixe gardiens_ = false", () => {
    expect(isNamedGoalkeeper({ position: "Gardien", link: "gardiens_marseille" })).toBe(false);
  });

  it("défenseur = false", () => {
    expect(isNamedGoalkeeper({ position: "Défenseur", link: null })).toBe(false);
  });
});

describe("quota « exactement 1 gardien » (règle 2.1)", () => {
  it("la position du pseudo-gardien est détectée comme gardien par mapPosition", () => {
    // mapPosition (db.ts, publish, lineup) détecte la ligne GK via
    // lower.includes("gardien") : la constante doit le satisfaire.
    expect(CLUB_GK_POSITION.toLowerCase()).toContain("gardien");
    expect(PSEUDO_GK.link!.startsWith(CLUB_GK_KEY_PREFIX)).toBe(true);
  });

  it("un pseudo-gardien compte comme LE gardien de l'effectif final", () => {
    const roster: EnginePlayer[] = [
      { id: 900, lastName: "Gardiens Marseille", line: "GK" },
      ...Array.from({ length: 5 }, (_, i) => ({ id: 1 + i, lastName: `D${i}`, line: "DEF" as const })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: 11 + i, lastName: `M${i}`, line: "MID" as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: 21 + i, lastName: `A${i}`, line: "ATT" as const })),
    ];
    expect(validateFinalRoster(roster)).toEqual([]);
  });
});
