import { cache } from "react";
import { prisma } from "./prisma";
import { LEGACY_SEASON_KEY, seasonKeyFromLabel } from "./season-key";

// ⚠️ Ce module utilise react.cache : ne pas l'importer depuis un script CLI
// (même contrainte que db.ts). Les scripts utilisent prisma + season-key.ts.

// Saison courante (Season.isCurrent). Null = aucune saison lancée sur la
// plateforme : tout le runtime retombe sur le comportement legacy
// (données non scopées, clé saison "2025-2026").
export const getCurrentSeason = cache(async () => {
  return prisma.season.findFirst({ where: { isCurrent: true } });
});

// Périmètre de scoping de la saison courante. Chaque entité a son propre
// fallback : si la saison courante n'a aucune row scopée pour une entité
// (cas de la saison legacy 2026 : ligues rattachées mais clubs/joueurs NULL),
// les requêtes restent non scopées pour cette entité. Filet de sécurité :
// le lancement d'une saison via l'admin exige que tout soit scopé.
export const getSeasonScope = cache(async () => {
  const season = await getCurrentSeason();
  if (!season) {
    return { season: null, hasLeagues: false, hasClubs: false, hasPlayers: false };
  }
  const [leagues, clubs, players] = await Promise.all([
    prisma.league.count({ where: { seasonId: season.id } }),
    prisma.club.count({ where: { seasonId: season.id } }),
    prisma.player.count({ where: { seasonId: season.id } }),
  ]);
  return {
    season,
    hasLeagues: leagues > 0,
    hasClubs: clubs > 0,
    hasPlayers: players > 0,
  };
});

// Filtres Prisma prêts à l'emploi pour scoper une requête sur la saison
// courante, avec le même fallback legacy entité par entité que getSeasonScope.
export async function getSeasonFilters() {
  const scope = await getSeasonScope();
  return {
    league:
      scope.season && scope.hasLeagues
        ? { seasonId: scope.season.id }
        : { id: { gt: 0 } }, // legacy : exclut la ligue 0
    club: scope.season && scope.hasClubs ? { seasonId: scope.season.id } : {},
    player: scope.season && scope.hasPlayers ? { seasonId: scope.season.id } : {},
  };
}

// Clé "YYYY-YYYY" pour les tables SQL legacy et TheSportsDB.
export async function getCurrentSeasonKey(): Promise<string> {
  const season = await getCurrentSeason();
  if (season) {
    const key = seasonKeyFromLabel(season.label);
    if (key) return key;
  }
  return LEGACY_SEASON_KEY;
}
