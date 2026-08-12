import { cache } from "react";
import { prisma } from "./prisma";
import { getCurrentSeasonKey } from "./season";
import {
  SCORING_DEFAULTS,
  goalBonusForPosition,
  computePlayerTotal,
  type ScoringConfig,
} from "./scoring-core";

// Re-export du socle pur pour les importeurs existants (db.ts, etc.).
export { goalBonusForPosition, computePlayerTotal, type ScoringConfig };

const DEFAULTS = SCORING_DEFAULTS;

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
    const seasonKey = await getCurrentSeasonKey();
    const rows = await prisma.$queryRawUnsafe<ScoringConfigRow[]>(
      "SELECT goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att, csc_malus, penalty_saved_bonus, red_card_note_zero, min_note FROM SCORING_CONFIG WHERE season = ? LIMIT 1",
      seasonKey
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
