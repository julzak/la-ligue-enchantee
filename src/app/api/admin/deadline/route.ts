export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getCurrentSeasonKey } from "@/lib/season";
import { getCurrentMatchday } from "@/lib/db";

// Deadline config (loaded from DB, with defaults)
interface DeadlineConfig {
  defaultHour: number;       // e.g. 15 = 15h Paris
  earlyMatchHour: number;    // e.g. 17 = if match before 17h Paris
  earlyMatchOffsetHours: number; // e.g. 2 = deadline 2h before kickoff
}

const DEFAULT_DEADLINE_CONFIG: DeadlineConfig = {
  defaultHour: 15,
  earlyMatchHour: 17,
  earlyMatchOffsetHours: 2,
};

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

function calcDeadline(matches: { date: string; time: string }[], config: DeadlineConfig): Date {
  if (matches.length === 0) {
    // Fallback: next Thursday midnight
    const now = new Date();
    const d = (4 - now.getDay() + 7) % 7 || 7;
    const dt = new Date(now);
    dt.setDate(now.getDate() + d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  // Sort matches by date+time
  const sorted = [...matches].sort((a, b) => {
    const da = a.date + (a.time || "00:00");
    const db = b.date + (b.time || "00:00");
    return da.localeCompare(db);
  });

  const firstMatch = sorted[0];
  const firstDate = new Date(firstMatch.date + "T" + (firstMatch.time || "20:00") + ":00+02:00"); // Paris time

  // Default deadline: config.defaultHour Paris time on the day of the first match
  const defaultUtcHour = config.defaultHour - 2; // Paris = UTC+2
  const defaultDeadline = new Date(firstMatch.date + `T${String(defaultUtcHour).padStart(2, "0")}:00:00Z`);

  // Early match threshold
  const earlyUtcHour = config.earlyMatchHour - 2;
  const earlyThreshold = new Date(firstMatch.date + `T${String(earlyUtcHour).padStart(2, "0")}:00:00Z`);

  if (firstDate < earlyThreshold) {
    // Match before threshold: deadline is N hours before kickoff
    return new Date(firstDate.getTime() - config.earlyMatchOffsetHours * 60 * 60 * 1000);
  }

  return defaultDeadline;
}

// GET: get deadline for a matchday (or current)
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
    return NextResponse.json({ day: currentDay, lockAt: config[0].lock_at, source: "manual" });
  }

  // Load deadline config from DB
  const deadlineConfig = await getDeadlineConfig();

  // Auto-calculate: fetch match dates/times from TheSportsDB
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=4334&r=${currentDay}&s=${await getCurrentSeasonKey()}`,
      { next: { revalidate: 3600 } } // cache 1h
    );
    const data = await res.json();
    if (data.events?.length > 0) {
      const matches = data.events.map((e: { dateEvent: string; strTime: string }) => ({
        date: e.dateEvent,
        time: e.strTime?.slice(0, 5) || "20:00",
      }));
      const lockAt = calcDeadline(matches, deadlineConfig);
      const firstMatch = matches.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))[0];
      return NextResponse.json({ day: currentDay, lockAt, source: "auto", firstMatch: firstMatch.date });
    }
  } catch {}

  // Fallback
  const lockAt = calcDeadline([], deadlineConfig);
  return NextResponse.json({ day: currentDay, lockAt, source: "fallback" });
}

// POST: set deadline for a matchday
export async function POST(request: Request) {
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
