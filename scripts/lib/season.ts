/**
 * Résolution de la saison courante pour les scripts CLI.
 * N'importe PAS src/lib/season.ts (react.cache plante hors RSC) :
 * uniquement les helpers purs de season-key.ts + le prisma du script.
 */

import type { PrismaClient } from "@prisma/client";
import { seasonKeyFromLabel, LEGACY_SEASON_KEY } from "../../src/lib/season-key";

// Clé "YYYY-YYYY" (tables SQL + TheSportsDB) de la saison courante en base.
// Fallback legacy "2025-2026" si aucune saison isCurrent ou label inexploitable.
export async function resolveSeasonKey(prisma: PrismaClient): Promise<string> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (season) {
    const key = seasonKeyFromLabel(season.label);
    if (key) return key;
    console.warn(`[season] Label "${season.label}" inexploitable, fallback ${LEGACY_SEASON_KEY}`);
  }
  return LEGACY_SEASON_KEY;
}

// Journée courante de la saison : max(SCORE.DAY) des joueurs de la saison
// isCurrent si elle a des joueurs scopés, sinon max global (legacy).
export async function resolveCurrentMatchday(prisma: PrismaClient): Promise<number> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (season) {
    const scopedPlayers = await prisma.player.count({ where: { seasonId: season.id } });
    if (scopedPlayers > 0) {
      const rows = await prisma.$queryRawUnsafe<{ maxDay: number | null }[]>(
        "SELECT MAX(s.DAY) AS maxDay FROM SCORE s JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER WHERE p.ID_SEASON = ?",
        season.id
      );
      const maxDay = rows[0]?.maxDay;
      return maxDay != null ? Number(maxDay) : 1;
    }
  }
  const latest = await prisma.score.findFirst({ orderBy: { day: "desc" } });
  return latest?.day ?? 1;
}
