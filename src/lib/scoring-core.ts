// Socle PUR du calcul de score (aucune dependance react/prisma) : source unique
// de verite du bareme, partagee par le moteur autoritaire (publish -> STATS_USER,
// = le classement affiche) et le moteur d'affichage (db.ts, fiches joueurs).
// Avant l'unification, publish codait le bareme en dur et ignorait SCORING_CONFIG,
// alors que db.ts lisait la config : editer le bareme faisait diverger fiches et
// classement. Ce module elimine la divergence et rend le bareme testable en
// isolation (scoring-core.test.ts + scripts/test-bareme-*.ts).

export interface ScoringConfig {
  goalBonusGk: number;
  goalBonusDef: number;
  goalBonusMid: number;
  goalBonusAtt: number;
  cscMalus: number;
  penaltySavedBonus: number;
  redCardNoteZero: boolean;
  minNote: number;
}

// Bareme historique (20 ans) : valeurs par defaut. Toute la logique tombe sur
// ces valeurs tant qu'aucune ligne SCORING_CONFIG n'existe.
export const SCORING_DEFAULTS: ScoringConfig = {
  goalBonusGk: 10,
  goalBonusDef: 4,
  goalBonusMid: 2,
  goalBonusAtt: 2,
  cscMalus: -2,
  penaltySavedBonus: 2,
  redCardNoteZero: true,
  minNote: 0,
};

// Bonus par but selon le poste.
export function goalBonusForPosition(position: string, config: ScoringConfig): number {
  const p = position.toLowerCase();
  if (p.includes("gardien") || p === "gk") return config.goalBonusGk;
  if (p.includes("fense") || p === "def") return config.goalBonusDef;
  if (p.includes("milieu") || p === "mid") return config.goalBonusMid;
  return config.goalBonusAtt;
}

export interface PlayerScoreInput {
  // Note L'Equipe. Conventions de saisie amont (non calculees ici) :
  //   forfait / pas de ligne SCORE  -> le joueur est ignore par le moteur (0 pt)
  //   joue mais non note par L'Equipe -> 2 (saisi a la main)
  points: number;
  goals: number;
  passes: number;
  position: string;
  redCard?: boolean;
  ownGoals?: number;
  penaltySaved?: number;
}

// Total d'un joueur aligne. Le carton rouge met la NOTE a 0 (si redCardNoteZero)
// mais CONSERVE les bonus buts/passes. Plancher applique = minNote.
export function computePlayerTotal(input: PlayerScoreInput, cfg: ScoringConfig): number {
  const base = input.redCard && cfg.redCardNoteZero ? 0 : input.points;
  const gb = goalBonusForPosition(input.position, cfg);
  const total =
    base +
    gb * input.goals +
    input.passes +
    cfg.cscMalus * (input.ownGoals ?? 0) +
    cfg.penaltySavedBonus * (input.penaltySaved ?? 0);
  return Math.max(cfg.minNote, total);
}

// Note de base retenue apres application eventuelle du carton rouge (sert a la
// colonne "forfait/note" de STATS_USER, distincte du total).
export function baseNoteAfterRedCard(points: number, redCard: boolean, cfg: ScoringConfig): number {
  return redCard && cfg.redCardNoteZero ? 0 : points;
}
