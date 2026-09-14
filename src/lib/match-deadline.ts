import { parisWallTimeToUtc } from "./paris-time";

// Deadline de saisie d'une journée : socle pur partagé par le verrouillage par
// club (db.ts getLockedClubIds) et la route /api/admin/deadline (bandeau,
// pré-remplissage admin). Avant l'unification, les deux chemins divergeaient et
// se trompaient chacun à leur façon (signalement Pierre 2026-09-14 : clôture à
// 15h alors que Lille-Troyes dimanche 15h imposait 13h).

export interface DeadlineConfig {
  /** Heure de deadline par défaut, en heure de Paris (15 = 15h). */
  defaultHour: number;
  /** Seuil : un coup d'envoi strictement avant cette heure avance la deadline. */
  earlyMatchHour: number;
  /** Avance en heures avant le coup d'envoi pour un match "tôt". */
  earlyMatchOffsetHours: number;
}

export const DEFAULT_DEADLINE_CONFIG: DeadlineConfig = {
  defaultHour: 15,
  earlyMatchHour: 17,
  earlyMatchOffsetHours: 2,
};

export interface WallTime { hour: number; minute: number }

/**
 * MATCH_SCHEDULE.match_time (TIME MySQL) est écrit en HEURE DE PARIS par la
 * synchro football-data (toParisDateTime). Prisma renvoie une colonne TIME
 * sous forme de Date `1970-01-01T<HH:MM:SS>Z` : le "Z" est un artefact
 * d'encodage, les champs UTC de cette Date SONT l'heure murale de Paris.
 * Accepte aussi une chaîne "HH:MM[:SS]". Null si absent ou illisible.
 */
export function matchTimeToWall(value: unknown): WallTime | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { hour: value.getUTCHours(), minute: value.getUTCMinutes() };
  }
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Coup d'envoi supposé quand l'heure est inconnue (match du soir). */
export const UNKNOWN_KICKOFF: WallTime = { hour: 20, minute: 0 };

export function earliestKickoff(kickoffs: WallTime[]): WallTime {
  if (kickoffs.length === 0) return UNKNOWN_KICKOFF;
  return kickoffs.reduce((a, b) => (b.hour * 60 + b.minute < a.hour * 60 + a.minute ? b : a));
}

/**
 * Instant UTC de la deadline pour une date de match (YYYY-MM-DD, heure de
 * Paris) : defaultHour, avancée à (premier coup d'envoi - offset) si ce coup
 * d'envoi est avant earlyMatchHour. Jamais avant minuit le jour même.
 */
export function deadlineForDate(dateYmd: string, kickoffs: WallTime[], cfg: DeadlineConfig): Date {
  const first = earliestKickoff(kickoffs);
  const threshold = parisWallTimeToUtc(dateYmd, cfg.earlyMatchHour);
  const kickoffUtc = parisWallTimeToUtc(dateYmd, first.hour, first.minute);
  if (kickoffUtc < threshold) {
    const advanced = new Date(kickoffUtc.getTime() - cfg.earlyMatchOffsetHours * 3_600_000);
    const midnight = parisWallTimeToUtc(dateYmd, 0);
    return advanced < midnight ? midnight : advanced;
  }
  return parisWallTimeToUtc(dateYmd, cfg.defaultHour);
}
