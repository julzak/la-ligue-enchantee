export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: get deadline for a matchday (or current)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = Number(searchParams.get("day") ?? 0);

  if (day > 0) {
    const config = await prisma.$queryRawUnsafe<{ day: number; lock_at: Date | null }[]>(
      "SELECT day, lock_at FROM MATCHDAY_CONFIG WHERE day = ?", day
    );
    if (config.length > 0 && config[0].lock_at) {
      return NextResponse.json({ day, lockAt: config[0].lock_at });
    }
  }

  // Get current matchday
  const latest = await prisma.score.findFirst({ orderBy: { day: "desc" } });
  const currentDay = (latest?.day ?? 26) + 1;

  const config = await prisma.$queryRawUnsafe<{ day: number; lock_at: Date | null }[]>(
    "SELECT day, lock_at FROM MATCHDAY_CONFIG WHERE day = ?", currentDay
  );

  return NextResponse.json({
    day: currentDay,
    lockAt: config.length > 0 ? config[0].lock_at : null,
  });
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
