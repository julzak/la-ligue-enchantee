import { prisma } from "./prisma";

export type EffectiveLineupEntry = { playerId: number; indx: number };

// Règle de repli quand un participant n'a pas validé de compo pour la journée :
// on reprend sa DERNIÈRE compo validée, quelle que soit son ancienneté, privée
// des joueurs sortis de l'effectif depuis. Bug corrigé le 2026-11-10 : le repli
// ne remontait qu'à la veille puis prenait les 11 premières lignes de TEAM sans
// ordre garanti (dès le 2e oubli d'affilée, 11 joueurs « au hasard » : cas
// Charles L3 J10, 46 équipes-journées faussées sur la saison 2026-2027).
// Fonction pure, testée dans effective-lineup.test.ts.
export function resolveEffectiveLineup(input: {
  today: EffectiveLineupEntry[];
  lastSaved: EffectiveLineupEntry[] | null;
  activePlayerIds: Set<number>;
  teamFallback: EffectiveLineupEntry[];
}): EffectiveLineupEntry[] {
  if (input.today.length > 0) return input.today;
  if (input.lastSaved && input.lastSaved.length > 0) {
    return input.lastSaved.filter((e) => input.activePlayerIds.has(e.playerId));
  }
  return input.teamFallback;
}

// Compo réellement comptée pour une journée. Source unique pour publish
// (STATS_USER = classement) et l'affichage (fiche équipe, page journée,
// chronique Lia, résumé de l'éditeur « Mon équipe »).
// Requêtes brutes : prisma.teamDay plante sur les DT_VALID '0000-00-00' legacy.
export async function getEffectiveLineup(
  leagueId: number,
  userId: number,
  day: number,
): Promise<EffectiveLineupEntry[]> {
  const rowsForDay = async (d: number) =>
    (await prisma.$queryRawUnsafe<{ playerId: number; indx: number }[]>(
      "SELECT ID_PLAYER as playerId, INDX as indx FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY = ? ORDER BY INDX",
      leagueId, userId, d
    )).map((r) => ({ playerId: Number(r.playerId), indx: Number(r.indx) }));

  const today = await rowsForDay(day);
  if (today.length > 0) return today;

  const teamMembers = await prisma.team.findMany({
    where: { leagueId, userId, dayFirst: { lte: day }, dayLast: { gte: day } },
    orderBy: [{ dayFirst: "asc" }, { playerId: "asc" }], // ordre déterministe
  });

  const last = await prisma.$queryRawUnsafe<{ day: number | null }[]>(
    "SELECT MAX(DAY) as day FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY < ?",
    leagueId, userId, day
  );
  const lastDay = last[0]?.day == null ? null : Number(last[0].day);

  return resolveEffectiveLineup({
    today,
    lastSaved: lastDay === null ? null : await rowsForDay(lastDay),
    activePlayerIds: new Set(teamMembers.map((t) => t.playerId)),
    teamFallback: teamMembers
      .filter((t) => t.isSubs === 0)
      .slice(0, 11)
      .map((t, i) => ({ playerId: t.playerId, indx: i + 1 })),
  });
}
