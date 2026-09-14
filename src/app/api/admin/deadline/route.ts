export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getCurrentSeasonKey } from "@/lib/season";
import { getCurrentMatchday } from "@/lib/db";
import {
  DEFAULT_DEADLINE_CONFIG,
  deadlineForDate,
  matchTimeToWall,
  type DeadlineConfig,
  type WallTime,
} from "@/lib/match-deadline";

async function getDeadlineConfig(): Promise<DeadlineConfig> {
  try {
    const rows = await prisma.$queryRawUnsafe<{
      deadline_hour: number; early_match_hour: number; early_match_offset_hours: number;
    }[]>(
      "SELECT deadline_hour, early_match_hour, early_match_offset_hours FROM SCORING_CONFIG WHERE season = ? LIMIT 1",
      await getCurrentSeasonKey()
    );
    if (rows.length > 0) {
      return {
        defaultHour: Number(rows[0].deadline_hour),
        earlyMatchHour: Number(rows[0].early_match_hour),
        earlyMatchOffsetHours: Number(rows[0].early_match_offset_hours),
      };
    }
  } catch {}
  return DEFAULT_DEADLINE_CONFIG;
}

// Meme calcul que getLockedClubIds (db.ts), via match-deadline.ts. Avant :
// l'heure etait parsee avec String(date).slice(0, 5) sur la Date Prisma d'une
// colonne TIME ("Thu J" -> NaN), donc la route repondait toujours 15h
// (signalement Pierre 2026-09-14).
function calcDeadlines(matches: { date: string; kickoff: WallTime | null }[], config: DeadlineConfig): Date[] {
  if (matches.length === 0) {
    const now = new Date();
    const d = (4 - now.getDay() + 7) % 7 || 7;
    const dt = new Date(now);
    dt.setDate(now.getDate() + d);
    dt.setHours(0, 0, 0, 0);
    return [dt];
  }
  const byDate = new Map<string, WallTime[]>();
  for (const m of matches) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    if (m.kickoff) byDate.get(m.date)!.push(m.kickoff);
  }
  return Array.from(byDate.entries())
    .map(([date, kickoffs]) => deadlineForDate(date, kickoffs, config))
    .sort((a, b) => a.getTime() - b.getTime());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayParam = Number(searchParams.get("day") ?? 0);

  // Get current matchday (scopé saison courante)
  const currentDay = dayParam > 0 ? dayParam : (await getCurrentMatchday()) + 1;

  // Check if admin set a manual deadline
  const config = await prisma.$queryRawUnsafe<{ day: number; lock_at: Date | null }[]>(
    "SELECT day, lock_at FROM MATCHDAY_CONFIG WHERE day = ?", currentDay
  );

  if (config.length > 0 && config[0].lock_at) {
    return NextResponse.json({ day: currentDay, lockAt: config[0].lock_at, lockDates: [config[0].lock_at], source: "manual" });
  }

  // Load deadline config from DB
  const deadlineConfig = await getDeadlineConfig();

  // Auto-calculate depuis MATCH_SCHEDULE (synchronisé depuis football-data.org,
  // heure de Paris). AVANT le 2026-08-17 : appel direct TheSportsDB clé "3",
  // qui tronque chaque journée à 5 matchs sur 9 : si le vrai premier match
  // n'était pas dans les 5, la deadline calculée était trop tardive. Les matchs
  // reportés sans nouvelle date sont exclus (leur date d'origine est passée) ;
  // un report re-daté par l'admin compte à sa nouvelle date.
  try {
    const rows = await prisma.$queryRawUnsafe<{ d: string | Date; t: Date | string | null }[]>(
      `SELECT COALESCE(admin_override_date, match_date) AS d, match_time AS t
         FROM MATCH_SCHEDULE
        WHERE season = ? AND matchday = ?
          AND NOT (is_postponed = 1 AND admin_override_date IS NULL)`,
      await getCurrentSeasonKey(), currentDay
    );
    if (rows.length > 0) {
      const matches = rows.map((r) => ({
        date: String(r.d instanceof Date ? r.d.toISOString().slice(0, 10) : r.d).slice(0, 10),
        kickoff: matchTimeToWall(r.t),
      }));
      const lockDates = calcDeadlines(matches, deadlineConfig);
      const firstMatch = matches.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))[0];
      return NextResponse.json({ day: currentDay, lockAt: lockDates[0], lockDates, source: "auto", firstMatch: firstMatch.date });
    }
  } catch {}

  // Fallback
  const lockDates = calcDeadlines([], deadlineConfig);
  return NextResponse.json({ day: currentDay, lockAt: lockDates[0], lockDates, source: "fallback" });
}

// POST: set deadline for a matchday
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const { day, lockAt } = await request.json() as { day: number; lockAt: string };

    await prisma.$executeRawUnsafe(
      `INSERT INTO MATCHDAY_CONFIG (day, lock_at, status) VALUES (?, ?, 'upcoming')
       ON DUPLICATE KEY UPDATE lock_at = VALUES(lock_at)`,
      day, new Date(lockAt)
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError500("[deadline]", e, "Échec de l'enregistrement de la deadline");
  }
}
