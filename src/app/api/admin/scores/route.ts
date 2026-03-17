import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

// GET: fetch scores for a matchday
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const day = Number(searchParams.get("day") ?? 0);
  if (!day) return NextResponse.json({ error: "day required" }, { status: 400 });

  const scores = await prisma.score.findMany({ where: { day } });
  const players = await prisma.player.findMany();
  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));
  const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

  const data = players.map((p) => {
    const score = scoreMap.get(p.id);
    return {
      playerId: p.id,
      fname: p.fname,
      lname: p.lname,
      position: p.position,
      clubId: p.clubId,
      clubName: clubMap.get(p.clubId) ?? "",
      used: score?.used ?? 0,
      points: score ? Number(score.points) : null,
      goals: score?.goals ?? 0,
      passes: score?.passes ?? 0,
    };
  });

  let activeClubs = await prisma.clubValid.findMany({ where: { day, isValid: 1 } });
  if (activeClubs.length === 0) {
    const latest = await prisma.clubValid.findFirst({
      where: { isValid: 1 },
      orderBy: { day: "desc" },
    });
    if (latest) {
      activeClubs = await prisma.clubValid.findMany({ where: { day: latest.day, isValid: 1 } });
    }
  }

  const activeClubIds = new Set(activeClubs.map((c) => c.clubId));
  const filtered = data.filter((p) => scoreMap.has(p.playerId) || activeClubIds.has(p.clubId));

  filtered.sort((a, b) => {
    if (a.clubName !== b.clubName) return a.clubName.localeCompare(b.clubName);
    return a.position.localeCompare(b.position);
  });

  return NextResponse.json({ scores: filtered, day });
}

// POST: save scores for a matchday (parameterized SQL)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { day, scores } = await request.json() as {
      day: number;
      scores: { playerId: number; used: number; points: number | null; goals: number; passes: number }[];
    };

    if (!day || !scores) {
      return NextResponse.json({ error: "day and scores required" }, { status: 400 });
    }

    const toSave = scores.filter(
      (s) => !(s.points === null && s.goals === 0 && s.passes === 0 && s.used === 0)
    );

    // Parameterized upserts to prevent SQL injection
    for (const s of toSave) {
      const playerId = Math.round(Number(s.playerId));
      const used = Math.round(Number(s.used));
      const points = Number(s.points ?? 0);
      const goals = Math.round(Number(s.goals));
      const passes = Math.round(Number(s.passes));

      if (isNaN(playerId) || isNaN(points)) continue;

      await prisma.$executeRawUnsafe(
        `INSERT INTO SCORE (ID_PLAYER, DAY, USED, POINTS, GOALS, PASSES)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE USED=VALUES(USED), POINTS=VALUES(POINTS), GOALS=VALUES(GOALS), PASSES=VALUES(PASSES)`,
        playerId, day, used, points, goals, passes
      );
    }

    return NextResponse.json({ ok: true, saved: toSave.length });
  } catch (error) {
    console.error("Save scores error:", error);
    return NextResponse.json({ error: "Erreur sauvegarde" }, { status: 500 });
  }
}
