// Accès DB au quota de jokers (socle pur : joker-quota-core.ts).
// Ne dépend pas de db.ts (qui repose sur react.cache) pour rester utilisable
// depuis les routes API et les scripts diag.

import { prisma } from "./prisma";
import { getCurrentSeasonKey } from "./season";
import { computeJokerQuota, type JokerPool, type JokerQuota } from "./joker-quota-core";

export type { JokerQuota } from "./joker-quota-core";

async function loadJokerPools(): Promise<JokerPool[]> {
  const rows = await prisma.$queryRawUnsafe<{ type: string; max_count: number; deadline: Date | string | null }[]>(
    "SELECT type, max_count, deadline FROM JOKER_CONFIG WHERE season = ? AND is_active = 1",
    await getCurrentSeasonKey()
  );
  return rows.map((r) => ({ type: r.type, maxCount: Number(r.max_count), deadline: r.deadline }));
}

/** Quota d'un participant dans une ligue (utilisés / restants), à l'instant `now`. */
export async function getJokerQuotaForUser(
  leagueId: number,
  userId: number,
  now: Date = new Date()
): Promise<JokerQuota> {
  const [pools, logs] = await Promise.all([
    loadJokerPools(),
    prisma.$queryRawUnsafe<{ created_at: Date | string | null }[]>(
      "SELECT created_at FROM JOKER_LOG WHERE league_id = ? AND user_id = ? ORDER BY id ASC",
      leagueId, userId
    ),
  ]);
  return computeJokerQuota(now, pools, logs.map((l) => l.created_at));
}

/**
 * Quotas de tous les participants d'une ligue (classement). `defaultQuota`
 * = quota d'un participant sans aucun joker posé.
 */
export async function getLeagueJokerQuotas(
  leagueId: number,
  now: Date = new Date()
): Promise<{ byUser: Map<number, JokerQuota>; defaultQuota: JokerQuota }> {
  const [pools, logs] = await Promise.all([
    loadJokerPools(),
    prisma.$queryRawUnsafe<{ user_id: number | bigint; created_at: Date | string | null }[]>(
      "SELECT user_id, created_at FROM JOKER_LOG WHERE league_id = ? ORDER BY id ASC",
      leagueId
    ),
  ]);
  const usedAtByUser = new Map<number, (Date | string | null)[]>();
  for (const l of logs) {
    const uid = Number(l.user_id);
    const arr = usedAtByUser.get(uid) ?? [];
    arr.push(l.created_at);
    usedAtByUser.set(uid, arr);
  }
  const byUser = new Map<number, JokerQuota>();
  for (const [uid, usedAt] of Array.from(usedAtByUser.entries())) {
    byUser.set(uid, computeJokerQuota(now, pools, usedAt));
  }
  return { byUser, defaultQuota: computeJokerQuota(now, pools, []) };
}
