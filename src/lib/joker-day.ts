import { prisma } from "./prisma";
import { getCurrentSeasonKey } from "./season";
import { getCurrentMatchday } from "./db";
import { computeJokerEffectDay } from "./joker-day-core";

export { JOKER_CUTOFF, jokerCutoffFor, computeJokerEffectDay } from "./joker-day-core";

/** Journée d'effet d'un joker posé maintenant, d'après le calendrier de la saison. */
export async function getJokerEffectDay(now = new Date()): Promise<{ effectDay: number; cutoff: Date | null; currentDay: number }> {
  const currentDay = await getCurrentMatchday();
  const rows = await prisma.$queryRawUnsafe<{ matchday: number; d: Date | string | null }[]>(
    `SELECT matchday, MIN(COALESCE(admin_override_date, match_date)) AS d
       FROM MATCH_SCHEDULE
      WHERE season = ? AND matchday > ?
        AND NOT (is_postponed = 1 AND admin_override_date IS NULL)
      GROUP BY matchday`,
    await getCurrentSeasonKey(), currentDay
  );
  const byDay = new Map<number, string>();
  for (const r of rows) {
    if (!r.d) continue;
    const ymd = r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) byDay.set(Number(r.matchday), ymd);
  }
  return { ...computeJokerEffectDay(now, currentDay, byDay), currentDay };
}

// ── Exécution du swap (partagée self-service / admin) ───────────────────
// Convention de stockage : JOKER_LOG.day = effectDay - 1 (= DAY_LAST du
// sortant, DAY_FIRST du sortant = effectDay). L'annulation admin s'appuie
// dessus (DAY_LAST = day, DAY_FIRST = day + 1).
export async function applyJokerSwap(params: {
  leagueId: number;
  userId: number;
  playerOutId: number;
  playerInId: number;
  outDayFirst: number;
  isSubs: number;
  effectDay: number;
}): Promise<void> {
  const { leagueId, userId, playerOutId, playerInId, outDayFirst, isSubs, effectDay } = params;
  const lastDayOut = effectDay - 1;

  await prisma.$executeRawUnsafe(
    "UPDATE TEAM SET DAY_LAST = ? WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY_FIRST = ?",
    lastDayOut, leagueId, userId, playerOutId, outDayFirst
  );
  await prisma.$executeRawUnsafe(
    "INSERT INTO TEAM (ID_LEAGUE, ID_USER, ID_PLAYER, DAY_FIRST, DAY_LAST, IS_SUBS) VALUES (?, ?, ?, ?, 38, ?)",
    leagueId, userId, playerInId, effectDay, isSubs
  );
  await prisma.$executeRawUnsafe(
    "INSERT INTO JOKER_LOG (league_id, user_id, player_out_id, player_in_id, day) VALUES (?, ?, ?, ?, ?)",
    leagueId, userId, playerOutId, playerInId, lastDayOut
  );

  await syncLineupForJoker({ leagueId, userId, playerOutId, playerInId, effectDay });
}

/**
 * Compo de la journée d'effet : si elle existe déjà, le sortant y est remplacé
 * par l'entrant ; sinon elle est recopiée depuis la dernière compo connue
 * (journée < effectDay) avec le remplacement. Sans ça, le sortant resterait
 * titulaire d'une journée où il n'est plus dans l'effectif.
 */
export async function syncLineupForJoker(params: {
  leagueId: number;
  userId: number;
  playerOutId: number;
  playerInId: number;
  effectDay: number;
}): Promise<void> {
  const { leagueId, userId, playerOutId, playerInId, effectDay } = params;
  const existing = await prisma.teamDay.findMany({ where: { leagueId, userId, day: effectDay } });
  if (existing.length > 0) {
    await prisma.teamDay.updateMany({
      where: { leagueId, userId, day: effectDay, playerId: playerOutId },
      data: { playerId: playerInId },
    });
    return;
  }
  const last = await prisma.$queryRawUnsafe<{ DAY: number }[]>(
    "SELECT DISTINCT DAY FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY < ? ORDER BY DAY DESC LIMIT 1",
    leagueId, userId, effectDay
  );
  if (last.length === 0) return;
  const prevLineup = await prisma.teamDay.findMany({
    where: { leagueId, userId, day: Number(last[0].DAY) },
  });
  if (prevLineup.length === 0) return;
  const now = new Date();
  await prisma.teamDay.createMany({
    data: prevLineup.map((l) => ({
      leagueId,
      userId,
      playerId: l.playerId === playerOutId ? playerInId : l.playerId,
      day: effectDay,
      indx: l.indx,
      isValid: l.isValid,
      dtSave: now,
      dtValid: now,
    })),
  });
}
