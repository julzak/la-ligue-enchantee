import { cache } from "react";
import { prisma } from "./prisma";
import { getCurrentSeasonKey } from "./season";
import { getScoringConfig, type ScoringConfig } from "./scoring-config";

// Config publique de la saison courante (demande Pierre, 2026-08-18) : source
// unique pour les pages participants (/reglement, /guide), afin que les
// chiffres de l'année (jokers, barème, deadlines) suivent automatiquement ce
// que les admins éditent dans Admin → Configuration, sans valeurs en dur.
export interface JokerQuota {
  type: string; // 'summer' | 'winter' | 'regular'
  maxCount: number;
  deadline: Date | null;
}

export interface SeasonPublicConfig {
  seasonKey: string;
  scoring: ScoringConfig;
  jokers: JokerQuota[];
  jokerTotal: number;
  deadlineHour: number;
  earlyMatchHour: number;
  earlyMatchOffsetHours: number;
}

export const JOKER_TYPE_LABELS: Record<string, string> = {
  summer: "Jokers mercato d'été",
  winter: "Jokers mercato d'hiver",
  regular: "Jokers saison",
};

export function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

export const getSeasonPublicConfig = cache(async (): Promise<SeasonPublicConfig> => {
  const seasonKey = await getCurrentSeasonKey();
  const scoring = await getScoringConfig();

  const jokerRows = await prisma.$queryRawUnsafe<{
    type: string; max_count: number; deadline: Date | null;
  }[]>(
    "SELECT type, max_count, deadline FROM JOKER_CONFIG WHERE season = ? AND is_active = 1 ORDER BY FIELD(type, 'summer', 'winter', 'regular')",
    seasonKey
  );
  const jokers = jokerRows.map((r) => ({
    type: r.type,
    maxCount: Number(r.max_count),
    deadline: r.deadline,
  }));

  const deadlineRows = await prisma.$queryRawUnsafe<{
    deadline_hour: number; early_match_hour: number; early_match_offset_hours: number;
  }[]>(
    "SELECT deadline_hour, early_match_hour, early_match_offset_hours FROM SCORING_CONFIG WHERE season = ? LIMIT 1",
    seasonKey
  );
  const dl = deadlineRows[0] ?? { deadline_hour: 15, early_match_hour: 17, early_match_offset_hours: 2 };

  return {
    seasonKey,
    scoring,
    jokers,
    jokerTotal: jokers.reduce((sum, j) => sum + j.maxCount, 0),
    deadlineHour: Number(dl.deadline_hour),
    earlyMatchHour: Number(dl.early_match_hour),
    earlyMatchOffsetHours: Number(dl.early_match_offset_hours),
  };
});
