import { cache } from "react";
import { prisma } from "./prisma";

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

const DEFAULTS: ScoringConfig = {
  goalBonusGk: 10,
  goalBonusDef: 4,
  goalBonusMid: 2,
  goalBonusAtt: 2,
  cscMalus: -2,
  penaltySavedBonus: 2,
  redCardNoteZero: true,
  minNote: 0,
};

interface ScoringConfigRow {
  goal_bonus_gk: number;
  goal_bonus_def: number;
  goal_bonus_mid: number;
  goal_bonus_att: number;
  csc_malus: number;
  penalty_saved_bonus: number;
  red_card_note_zero: number;
  min_note: number;
}

/**
 * Request-scoped cached scoring config.
 * Uses React cache() so within a single server render, the DB is hit at most once.
 */
export const getScoringConfig = cache(async (): Promise<ScoringConfig> => {
  try {
    const rows = await prisma.$queryRawUnsafe<ScoringConfigRow[]>(
      "SELECT goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att, csc_malus, penalty_saved_bonus, red_card_note_zero, min_note FROM SCORING_CONFIG WHERE season = '2025-2026' LIMIT 1"
    );
    if (!rows.length) return DEFAULTS;
    const r = rows[0];
    return {
      goalBonusGk: Number(r.goal_bonus_gk),
      goalBonusDef: Number(r.goal_bonus_def),
      goalBonusMid: Number(r.goal_bonus_mid),
      goalBonusAtt: Number(r.goal_bonus_att),
      cscMalus: Number(r.csc_malus),
      penaltySavedBonus: Number(r.penalty_saved_bonus),
      redCardNoteZero: Number(r.red_card_note_zero) === 1,
      minNote: Number(r.min_note),
    };
  } catch {
    // Fallback if table doesn't exist yet
    return DEFAULTS;
  }
});

/**
 * Get goal bonus for a position, using config values.
 */
export function goalBonusForPosition(position: string, config: ScoringConfig): number {
  const p = position.toLowerCase();
  if (p.includes("gardien") || p === "gk") return config.goalBonusGk;
  if (p.includes("fense") || p === "def") return config.goalBonusDef;
  if (p.includes("milieu") || p === "mid") return config.goalBonusMid;
  return config.goalBonusAtt;
}
