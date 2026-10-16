import { prisma } from "./prisma";

export type EffectiveLineupEntry = { playerId: number; indx: number };

// Compo réellement comptée pour une journée : TEAM_DAY du jour, sinon TEAM_DAY
// de la veille, sinon les 11 premiers titulaires de TEAM. Source unique pour
// publish (STATS_USER = classement) et l'affichage (fiche équipe, page journée,
// chronique Lia) : sans ça, un participant sans compo deux journées de suite
// avait des points au classement mais une fiche vide.
// Requêtes brutes : prisma.teamDay plante sur les DT_VALID '0000-00-00' legacy.
export async function getEffectiveLineup(
  leagueId: number,
  userId: number,
  day: number,
): Promise<EffectiveLineupEntry[]> {
  for (const d of day > 1 ? [day, day - 1] : [day]) {
    const rows = await prisma.$queryRawUnsafe<{ playerId: number; indx: number }[]>(
      "SELECT ID_PLAYER as playerId, INDX as indx FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY = ? ORDER BY INDX",
      leagueId, userId, d
    );
    if (rows.length > 0) {
      return rows.map((r) => ({ playerId: Number(r.playerId), indx: Number(r.indx) }));
    }
  }

  const teamMembers = await prisma.team.findMany({
    where: {
      leagueId,
      userId,
      dayFirst: { lte: day },
      dayLast: { gte: day },
      isSubs: 0,
    },
  });
  return teamMembers.slice(0, 11).map((t, i) => ({ playerId: t.playerId, indx: i + 1 }));
}
