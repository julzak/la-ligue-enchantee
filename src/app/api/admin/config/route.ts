import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getCurrentSeasonKey } from "@/lib/season";
import { getCurrentMatchday } from "@/lib/db";
import { getAppConfig, setAppConfig, CONFIG_KEYS } from "@/lib/app-config";

// Le driver renvoie les colonnes DATE/DATETIME en objet Date : String() donne
// "Wed Sep 02..." et .slice(0,10) un fragment inutilisable par un <input type=date>.
// Normalise en "YYYY-MM-DD" (en local, pour ne pas décaler d'un jour via UTC).
function toDateInput(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${mm}-${dd}`;
  }
  return String(value).slice(0, 10);
}

function maskKey(key: string | null): string | null {
  if (!key) return null;
  return key.length <= 4 ? "****" : `****${key.slice(-4)}`;
}

interface ScoringConfigRow {
  goal_bonus_gk: number;
  goal_bonus_def: number;
  goal_bonus_mid: number;
  goal_bonus_att: number;
  csc_malus: number;
  penalty_saved_bonus: number;
  red_card_note_zero: number;
  min_note: number;
  deadline_hour: number;
  early_match_hour: number;
  early_match_offset_hours: number;
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

  const CURRENT_SEASON = await getCurrentSeasonKey();
  const [scoringRows, jokerRows, mercatoRows] = await Promise.all([
    prisma.$queryRawUnsafe<ScoringConfigRow[]>(
      "SELECT goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att, csc_malus, penalty_saved_bonus, red_card_note_zero, min_note, deadline_hour, early_match_hour, early_match_offset_hours FROM SCORING_CONFIG WHERE season = ?",
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
    deadline_hour: 15,
    early_match_hour: 17,
    early_match_offset_hours: 2,
  };

  // Jokers
  const regularJoker = jokerRows.find((j) => j.type === "regular");
  const summerJoker = jokerRows.find((j) => j.type === "summer");
  const jokers = {
    regularCount: regularJoker ? Number(regularJoker.max_count) : 4,
    summerCount: summerJoker ? Number(summerJoker.max_count) : 2,
    summerDeadline: toDateInput(summerJoker?.deadline) ?? "2025-09-15",
  };

  // Mercato
  const winterMercato = mercatoRows.find((m) => m.type === "winter");
  const mercatoHiver = {
    rankingMatchday: winterMercato?.ranking_matchday ?? null,
    treveStart: toDateInput(winterMercato?.treve_start),
    treveEnd: toDateInput(winterMercato?.treve_end),
  };

  // Clés API effectifs/photos (jamais renvoyées en clair, seulement masquées)
  const [fdToken, sdbKey, sdbKeySetAt] = await Promise.all([
    getAppConfig(CONFIG_KEYS.FOOTBALL_DATA_TOKEN),
    getAppConfig(CONFIG_KEYS.THESPORTSDB_PREMIUM_KEY),
    getAppConfig(CONFIG_KEYS.THESPORTSDB_KEY_SET_AT),
  ]);

  // Le bareme n'est modifiable qu'avant le debut de saison (aucune journee
  // publiee) : au-dela, une edition ferait diverger le classement deja calcule.
  const seasonStarted = (await getCurrentMatchday()) > 0;

  return NextResponse.json({
    seasonStarted,
    effectifs: {
      footballDataToken: maskKey(fdToken),
      theSportsDbKey: maskKey(sdbKey),
      theSportsDbKeySetAt: sdbKeySetAt,
    },
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
    deadlines: {
      defaultHour: Number(scoring.deadline_hour),
      earlyMatchHour: Number(scoring.early_match_hour),
      earlyMatchOffsetHours: Number(scoring.early_match_offset_hours),
    },
  });
}

// POST: update config by section
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { section, data } = body;
  const CURRENT_SEASON = await getCurrentSeasonKey();

  if (!section || !data) {
    return NextResponse.json({ error: "section and data required" }, { status: 400 });
  }

  try {
    switch (section) {
      case "scoring": {
        // Verrou serveur : bareme fige des qu'une journee est publiee. C'est le
        // gate reel (le client ne fait qu'aider) : modifier le bareme en cours de
        // saison ferait diverger le classement STATS_USER deja calcule.
        if ((await getCurrentMatchday()) > 0) {
          return NextResponse.json(
            { error: "Le bareme ne peut etre modifie qu'avant le debut de la saison (aucune journee publiee)." },
            { status: 403 }
          );
        }
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
      }

      case "jokers": {
        // Upsert manuel : JOKER_CONFIG n'a pas d'index unique sur (season, type),
        // et les lignes de la saison n'existent pas avant le lancement (elles sont
        // clonées par /seasons/launch). Un simple UPDATE ne touchait AUCUNE ligne
        // pendant la phase enchères et l'enregistrement se perdait en silence.
        const upsertJoker = async (
          type: "regular" | "summer",
          maxCount: number,
          deadline: string | null
        ) => {
          const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
            "SELECT id FROM JOKER_CONFIG WHERE season = ? AND type = ? LIMIT 1",
            CURRENT_SEASON, type
          );
          if (existing.length > 0) {
            await prisma.$executeRawUnsafe(
              "UPDATE JOKER_CONFIG SET max_count = ?, deadline = ?, is_active = 1 WHERE id = ?",
              maxCount, deadline, Number(existing[0].id)
            );
          } else {
            await prisma.$executeRawUnsafe(
              "INSERT INTO JOKER_CONFIG (season, type, max_count, deadline, is_active) VALUES (?, ?, ?, ?, 1)",
              CURRENT_SEASON, type, maxCount, deadline
            );
          }
        };
        await upsertJoker("regular", data.regularCount, null);
        await upsertJoker("summer", data.summerCount, data.summerDeadline ?? null);
        break;
      }

      case "deadlines":
        // SCORING_CONFIG a un index unique sur season : on garantit la ligne de la
        // saison avant l'UPDATE (même cause que les jokers : ligne absente avant
        // le lancement, UPDATE silencieusement sans effet).
        await prisma.$executeRawUnsafe(
          "INSERT IGNORE INTO SCORING_CONFIG (season) VALUES (?)",
          CURRENT_SEASON
        );
        await prisma.$executeRawUnsafe(
          `UPDATE SCORING_CONFIG SET deadline_hour = ?, early_match_hour = ?, early_match_offset_hours = ? WHERE season = ?`,
          data.defaultHour ?? 15, data.earlyMatchHour ?? 17, data.earlyMatchOffsetHours ?? 2, CURRENT_SEASON
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

      case "effectifs":
        // Champ vide = on ne touche pas ; "CLEAR" explicite = on efface.
        if (typeof data.footballDataToken === "string" && data.footballDataToken.trim()) {
          await setAppConfig(
            CONFIG_KEYS.FOOTBALL_DATA_TOKEN,
            data.footballDataToken.trim() === "CLEAR" ? null : data.footballDataToken.trim()
          );
        }
        if (typeof data.theSportsDbKey === "string" && data.theSportsDbKey.trim()) {
          const clear = data.theSportsDbKey.trim() === "CLEAR";
          await setAppConfig(CONFIG_KEYS.THESPORTSDB_PREMIUM_KEY, clear ? null : data.theSportsDbKey.trim());
          await setAppConfig(
            CONFIG_KEYS.THESPORTSDB_KEY_SET_AT,
            clear ? null : new Date().toISOString().slice(0, 10)
          );
        }
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
