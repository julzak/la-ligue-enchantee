// Gel des jokers pendant le mercato d'hiver (règle Pierre, 2026-08-18) :
// les jokers sont figés du début du mercato d'hiver à sa fin (ex. 2026-2027 :
// du 1er janvier au 2 février 20h). Fenêtre stockée sur la ligne winter de
// MERCATO_CONFIG (jokers_freeze_start / jokers_freeze_end, DATETIME naïf
// comparé à l'heure locale du serveur, comme les deadlines JOKER_CONFIG).
// Une bannière prévient sur l'accueil et les pages ligue à partir de J-7.

import { prisma } from "@/lib/prisma";
import { getCurrentSeasonKey } from "@/lib/season";

export type JokersFreezePhase = "none" | "upcoming" | "active";

export const FREEZE_NOTICE_DAYS = 7;

export interface JokersFreezeState {
  phase: JokersFreezePhase;
  start: Date | null;
  end: Date | null;
}

// Fonction PURE (testée dans jokers-freeze.test.ts).
// - "active" : start <= now < end (tolérance zéro aux deux bornes : gelé pile
//   à l'instant de début, rouvert pile à l'instant de fin).
// - "upcoming" : dans les FREEZE_NOTICE_DAYS jours avant start (bannière).
// - fenêtre absente ou incohérente (end <= start) : "none", on ne gèle jamais
//   sur une config invalide.
export function computeFreezePhase(
  now: Date,
  start: Date | null,
  end: Date | null
): JokersFreezePhase {
  if (!start || !end) return "none";
  if (end.getTime() <= start.getTime()) return "none";
  if (now.getTime() >= end.getTime()) return "none";
  if (now.getTime() >= start.getTime()) return "active";
  const noticeFrom = start.getTime() - FREEZE_NOTICE_DAYS * 24 * 60 * 60 * 1000;
  if (now.getTime() >= noticeFrom) return "upcoming";
  return "none";
}

export async function getJokersFreeze(now: Date = new Date()): Promise<JokersFreezeState> {
  const season = await getCurrentSeasonKey();
  const rows = await prisma.$queryRawUnsafe<
    { jokers_freeze_start: Date | null; jokers_freeze_end: Date | null }[]
  >(
    "SELECT jokers_freeze_start, jokers_freeze_end FROM MERCATO_CONFIG WHERE season = ? AND type = 'winter' LIMIT 1",
    season
  );
  const start = rows[0]?.jokers_freeze_start ?? null;
  const end = rows[0]?.jokers_freeze_end ?? null;
  return { phase: computeFreezePhase(now, start, end), start, end };
}

// Libellés d'affichage (bannières, messages d'erreur API) : formatés côté
// serveur pour que le client n'ait jamais à re-parser un DATETIME naïf.
export function formatFreezeDate(d: Date, withTime: boolean): string {
  const day = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const dayLabel = d.getDate() === 1 ? day.replace(/^1 /, "1er ") : day;
  if (!withTime) return dayLabel;
  const h = d.getHours();
  const m = d.getMinutes();
  return `${dayLabel} à ${h}h${m ? String(m).padStart(2, "0") : ""}`;
}
