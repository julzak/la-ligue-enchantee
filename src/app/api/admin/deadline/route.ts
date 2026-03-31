export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Calculate deadline based on match schedule:
// - Friday match → Friday 15h (Paris)
// - Saturday match → Saturday 15h (Paris)
// - Sunday match → Sunday 15h (Paris)
// - Midweek match → 2h before first match kickoff, then 15h the next day
function calcDeadline(matches: { date: string; time: string }[]): Date {
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
  const dayOfWeek = firstDate.getDay(); // 0=Sun, 5=Fri, 6=Sat

  if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
    // Friday / Saturday / Sunday → deadline 15h Paris same day as first match
    const deadline = new Date(firstMatch.date + "T13:00:00Z"); // 13:00 UTC = 15:00 Paris
    return deadline;
  } else {
    // Midweek → 2h before first match kickoff
    const deadline = new Date(firstDate.getTime() - 2 * 60 * 60 * 1000);
    return deadline;
  }
}

// GET: get deadline for a matchday (or current)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayParam = Number(searchParams.get("day") ?? 0);

  // Get current matchday
  const latest = await prisma.score.findFirst({ orderBy: { day: "desc" } });
  const currentDay = dayParam > 0 ? dayParam : (latest?.day ?? 26) + 1;

  // Check if admin set a manual deadline
  const config = await prisma.$queryRawUnsafe<{ day: number; lock_at: Date | null }[]>(
    "SELECT day, lock_at FROM MATCHDAY_CONFIG WHERE day = ?", currentDay
  );

  if (config.length > 0 && config[0].lock_at) {
    return NextResponse.json({ day: currentDay, lockAt: config[0].lock_at, source: "manual" });
  }

  // Auto-calculate: fetch match dates/times from TheSportsDB
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=4334&r=${currentDay}&s=2025-2026`,
      { next: { revalidate: 3600 } } // cache 1h
    );
    const data = await res.json();
    if (data.events?.length > 0) {
      const matches = data.events.map((e: { dateEvent: string; strTime: string }) => ({
        date: e.dateEvent,
        time: e.strTime?.slice(0, 5) || "20:00",
      }));
      const lockAt = calcDeadline(matches);
      const firstMatch = matches.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))[0];
      return NextResponse.json({ day: currentDay, lockAt, source: "auto", firstMatch: firstMatch.date });
    }
  } catch {}

  // Fallback
  const lockAt = calcDeadline([]);
  return NextResponse.json({ day: currentDay, lockAt, source: "fallback" });
}

// POST: set deadline for a matchday
export async function POST(request: Request) {
  const { day, lockAt } = await request.json() as { day: number; lockAt: string };

  await prisma.$executeRawUnsafe(
    `INSERT INTO MATCHDAY_CONFIG (day, lock_at, status) VALUES (?, ?, 'upcoming')
     ON DUPLICATE KEY UPDATE lock_at = VALUES(lock_at)`,
    day, new Date(lockAt)
  );

  return NextResponse.json({ ok: true });
}
