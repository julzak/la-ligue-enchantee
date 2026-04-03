import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

const CURRENT_SEASON = "2025-2026";

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

interface JokerConfigRow {
  id: number;
  type: string;
  max_count: number;
  deadline: string | null;
  is_active: number;
}

interface MercatoConfigRow {
  type: string;
  ranking_matchday: number | null;
  treve_start: string | null;
  treve_end: string | null;
}

// GET: return all config for current season
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const [scoringRows, jokerRows, mercatoRows] = await Promise.all([
    prisma.$queryRawUnsafe<ScoringConfigRow[]>(
      "SELECT goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att, csc_malus, penalty_saved_bonus, red_card_note_zero, min_note FROM SCORING_CONFIG WHERE season = ?",
      CURRENT_SEASON
    ),
    prisma.$queryRawUnsafe<JokerConfigRow[]>(
      "SELECT id, type, max_count, deadline, is_active FROM JOKER_CONFIG WHERE season = ? AND is_active = 1",
      CURRENT_SEASON
    ),
    prisma.$queryRawUnsafe<MercatoConfigRow[]>(
      "SELECT type, ranking_matchday, treve_start, treve_end FROM MERCATO_CONFIG WHERE season = ?",
      CURRENT_SEASON
    ),
  ]);

  // Scoring defaults if no row
  const scoring = scoringRows[0] ?? {
    goal_bonus_gk: 10,
    goal_bonus_def: 4,
    goal_bonus_mid: 2,
    goal_bonus_att: 2,
    csc_malus: -2,
    penalty_saved_bonus: 2,
    red_card_note_zero: 1,
    min_note: 0,
  };

  // Jokers
  const regularJoker = jokerRows.find((j) => j.type === "regular");
  const summerJoker = jokerRows.find((j) => j.type === "summer");
  const jokers = {
    regularCount: regularJoker ? Number(regularJoker.max_count) : 4,
    summerCount: summerJoker ? Number(summerJoker.max_count) : 2,
    summerDeadline: summerJoker?.deadline ? String(summerJoker.deadline).slice(0, 10) : "2025-09-15",
  };

  // Mercato
  const winterMercato = mercatoRows.find((m) => m.type === "winter");
  const mercatoHiver = {
    rankingMatchday: winterMercato?.ranking_matchday ?? null,
    treveStart: winterMercato?.treve_start ? String(winterMercato.treve_start).slice(0, 10) : null,
    treveEnd: winterMercato?.treve_end ? String(winterMercato.treve_end).slice(0, 10) : null,
  };

  return NextResponse.json({
    scoring: {
      goalBonusGk: Number(scoring.goal_bonus_gk),
      goalBonusDef: Number(scoring.goal_bonus_def),
      goalBonusMid: Number(scoring.goal_bonus_mid),
      goalBonusAtt: Number(scoring.goal_bonus_att),
      cscMalus: Number(scoring.csc_malus),
      penaltySavedBonus: Number(scoring.penalty_saved_bonus),
      redCardNoteZero: Number(scoring.red_card_note_zero),
      minNote: Number(scoring.min_note),
    },
    jokers,
    mercatoHiver,
  });
}

// POST: update config by section
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { section, data } = body;

  if (!section || !data) {
    return NextResponse.json({ error: "section and data required" }, { status: 400 });
  }

  try {
    switch (section) {
      case "scoring":
        await prisma.$executeRawUnsafe(
          `INSERT INTO SCORING_CONFIG (season, goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att, csc_malus, penalty_saved_bonus, red_card_note_zero, min_note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE goal_bonus_gk=?, goal_bonus_def=?, goal_bonus_mid=?, goal_bonus_att=?, csc_malus=?, penalty_saved_bonus=?, red_card_note_zero=?, min_note=?`,
          CURRENT_SEASON,
          data.goalBonusGk, data.goalBonusDef, data.goalBonusMid, data.goalBonusAtt,
          data.cscMalus, data.penaltySavedBonus, data.redCardNoteZero ?? 1, data.minNote ?? 0,
          data.goalBonusGk, data.goalBonusDef, data.goalBonusMid, data.goalBonusAtt,
          data.cscMalus, data.penaltySavedBonus, data.redCardNoteZero ?? 1, data.minNote ?? 0
        );
        break;

      case "jokers":
        // Update regular jokers
        await prisma.$executeRawUnsafe(
          "UPDATE JOKER_CONFIG SET max_count = ? WHERE season = ? AND type = 'regular'",
          data.regularCount, CURRENT_SEASON
        );
        // Update summer jokers
        await prisma.$executeRawUnsafe(
          "UPDATE JOKER_CONFIG SET max_count = ?, deadline = ? WHERE season = ? AND type = 'summer'",
          data.summerCount, data.summerDeadline, CURRENT_SEASON
        );
        break;

      case "mercatoHiver":
        await prisma.$executeRawUnsafe(
          `INSERT INTO MERCATO_CONFIG (season, type, ranking_matchday, treve_start, treve_end)
           VALUES (?, 'winter', ?, ?, ?)
           ON DUPLICATE KEY UPDATE ranking_matchday=?, treve_start=?, treve_end=?`,
          CURRENT_SEASON,
          data.rankingMatchday ?? null, data.treveStart ?? null, data.treveEnd ?? null,
          data.rankingMatchday ?? null, data.treveStart ?? null, data.treveEnd ?? null
        );
        break;

      default:
        return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Config save error:", err);
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 });
  }
}
