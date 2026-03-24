export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Calculate Thursday midnight before a date
function thursdayBefore(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  // Go back to Thursday (4)
  let diff = day - 4;
  if (diff <= 0) diff += 7; // if it's Thu or earlier, go to previous Thu
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() - diff);
  thu.setUTCHours(22, 0, 0, 0); // 22:00 UTC = minuit heure de Paris
  return thu;
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

  // Auto-calculate: fetch first match date from TheSportsDB
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=4334&r=${currentDay}&s=2025-2026`,
      { next: { revalidate: 3600 } } // cache 1h
    );
    const data = await res.json();
    if (data.events?.length > 0) {
      const dates = data.events.map((e: { dateEvent: string }) => e.dateEvent).sort();
      const firstMatch = dates[0];
      const lockAt = thursdayBefore(firstMatch);
      return NextResponse.json({ day: currentDay, lockAt, source: "auto", firstMatch });
    }
  } catch {}

  // Fallback: next Thursday midnight
  const now = new Date();
  const d = (4 - now.getDay() + 7) % 7 || 7;
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + d);
  fallback.setHours(0, 0, 0, 0);

  return NextResponse.json({ day: currentDay, lockAt: fallback, source: "fallback" });
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
