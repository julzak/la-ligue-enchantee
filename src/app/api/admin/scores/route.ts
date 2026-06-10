import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasonFilters } from "@/lib/season";
import { getCurrentMatchday } from "@/lib/db";

// GET: fetch scores for a matchday
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const day = Number(searchParams.get("day") ?? 0);

  // If day=0, return the current matchday (for auto-detection)
  // Open on the latest day that has scores (not +1), so admin can review/complete
  if (!day) {
    return NextResponse.json({ day: await getCurrentMatchday() });
  }

  const filters = await getSeasonFilters();
  const [scores, players, clubs, takenTeams] = await Promise.all([
    prisma.score.findMany({ where: { day } }),
    prisma.player.findMany({ where: filters.player }),
    prisma.club.findMany({ where: filters.club }),
    // Players taken by at least one participant (in their 13-man squad)
    prisma.team.findMany({
      where: { dayFirst: { lte: day }, dayLast: { gte: day } },
      select: { playerId: true },
    }),
  ]);
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));
  const scoreMap = new Map(scores.map((s) => [s.playerId, s]));
  const takenPlayerIds = new Set(takenTeams.map((t) => t.playerId));

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
      redCard: score?.redCard ?? 0,
      ownGoals: score?.ownGoals ?? 0,
      penaltySaved: score?.penaltySaved ?? 0,
      isTaken: takenPlayerIds.has(p.id),
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
      scores: { playerId: number; used: number; points: number | null; goals: number; passes: number; redCard?: number; ownGoals?: number; penaltySaved?: number }[];
    };

    if (!day || !scores) {
      return NextResponse.json({ error: "day and scores required" }, { status: 400 });
    }

    const toSave = scores.filter(
      (s) => !(s.points === null && s.goals === 0 && s.passes === 0 && s.used === 0)
    );

    // Batch upsert: build a single INSERT ... VALUES (...), (...), ... ON DUPLICATE KEY UPDATE
    const validRows: { playerId: number; used: number; points: number; goals: number; passes: number; redCard: number; ownGoals: number; penaltySaved: number }[] = [];
    for (const s of toSave) {
      const playerId = Math.round(Number(s.playerId));
      const points = Number(s.points ?? 0);
      if (isNaN(playerId) || isNaN(points)) continue;
      validRows.push({
        playerId,
        used: Math.round(Number(s.used)),
        points,
        goals: Math.round(Number(s.goals)),
        passes: Math.round(Number(s.passes)),
        redCard: Math.round(Number(s.redCard ?? 0)),
        ownGoals: Math.round(Number(s.ownGoals ?? 0)),
        penaltySaved: Math.round(Number(s.penaltySaved ?? 0)),
      });
    }

    // Batch in chunks of 50 to avoid query size limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const values = batch.flatMap((r) => [r.playerId, day, r.used, r.points, r.goals, r.passes, r.redCard, r.ownGoals, r.penaltySaved]);
      await prisma.$executeRawUnsafe(
        `INSERT INTO SCORE (ID_PLAYER, DAY, USED, POINTS, GOALS, PASSES, RED_CARD, OWN_GOALS, PENALTY_SAVED)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE USED=VALUES(USED), POINTS=VALUES(POINTS), GOALS=VALUES(GOALS), PASSES=VALUES(PASSES), RED_CARD=VALUES(RED_CARD), OWN_GOALS=VALUES(OWN_GOALS), PENALTY_SAVED=VALUES(PENALTY_SAVED)`,
        ...values
      );
    }

    return NextResponse.json({ ok: true, saved: toSave.length });
  } catch (error) {
    console.error("Save scores error:", error);
    return NextResponse.json({ error: "Erreur sauvegarde" }, { status: 500 });
  }
}
