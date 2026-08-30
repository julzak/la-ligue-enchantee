// Diag lecture seule : divergence rosterDay (lecture) vs effectDay (écriture joker)
// Contexte : remontées Pierre 2026-08-30 (Yassine affiché Libre, Bakwa pas affiché libre)
import { prisma } from "../src/lib/prisma";
import { computeJokerEffectDay } from "../src/lib/joker-day-core";

async function main() {
  const seasons = await prisma.$queryRawUnsafe<{ id: number; label: string }[]>(
    "SELECT ID_SEASON id, LABEL label FROM SEASON WHERE IS_CURRENT = 1 LIMIT 1"
  );
  console.log("Saison courante:", seasons);
  const seasonId = seasons[0]?.id;
  const seasonKey = seasons[0]?.label?.replace("/", "-");

  const cur = await prisma.$queryRawUnsafe<{ d: number | null }[]>(
    "SELECT MAX(s.DAY) d FROM SCORE s JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER WHERE p.ID_SEASON = ?",
    seasonId
  );
  const currentDay = Number(cur[0]?.d ?? 0);
  console.log("currentDay (max SCORE.DAY saison):", currentDay);
  console.log("rosterDay utilisé par explorateur et /api/admin/jokers/free:", currentDay + 1);

  const rows = await prisma.$queryRawUnsafe<{ matchday: number; d: Date | string | null }[]>(
    `SELECT matchday, MIN(COALESCE(admin_override_date, match_date)) AS d
       FROM MATCH_SCHEDULE
      WHERE season = ? AND matchday > ?
        AND NOT (is_postponed = 1 AND admin_override_date IS NULL)
      GROUP BY matchday ORDER BY matchday LIMIT 4`,
    seasonKey, currentDay
  );
  console.log("Prochaines journées (MATCH_SCHEDULE):", rows);
  const byDay = new Map<number, string>();
  for (const r of rows) {
    if (!r.d) continue;
    const ymd = r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) byDay.set(Number(r.matchday), ymd);
  }
  const eff = computeJokerEffectDay(new Date(), currentDay, byDay);
  console.log("effectDay d'un joker posé maintenant:", eff.effectDay, "cutoff:", eff.cutoff);

  for (const lname of ["Yassine", "Bakwa"]) {
    const rows2 = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT t.ID_LEAGUE, t.ID_USER, t.DAY_FIRST, t.DAY_LAST, p.FNAME, p.LNAME
       FROM TEAM t JOIN PLAYER p ON p.ID_PLAYER = t.ID_PLAYER
       WHERE p.LNAME LIKE ? AND p.ID_SEASON = ?`,
      `%${lname}%`,
      seasonId
    );
    console.log(`TEAM rows pour ${lname}:`, rows2);
  }

  const logs = await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT j.league_id, j.user_id, j.day, pin.LNAME lname_in, pout.LNAME lname_out, j.created_at
     FROM JOKER_LOG j
     JOIN PLAYER pin ON pin.ID_PLAYER = j.player_in_id
     JOIN PLAYER pout ON pout.ID_PLAYER = j.player_out_id
     WHERE pin.LNAME LIKE '%Yassine%' OR pout.LNAME LIKE '%Bakwa%'`
  ).catch((e) => `(JOKER_LOG: ${e.message?.slice(0, 120)})`);
  console.log("JOKER_LOG Yassine/Bakwa:", logs);
}

main().finally(() => prisma.$disconnect());
