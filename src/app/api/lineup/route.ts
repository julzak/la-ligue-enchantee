import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserAdmin } from "@/lib/admin-auth";
import type { Position } from "@/lib/types";

interface StarterEntry {
  playerId: number;
  indx: number;
}

interface LineupPayload {
  leagueId: number;
  day: number;
  starters: StarterEntry[];
  userId?: number; // admin override: target user whose team is being edited
}

// Position constraints for a valid lineup
function validatePositionConstraints(
  starters: { playerId: number; position: Position }[]
): string[] {
  const errors: string[] = [];
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };

  for (const s of starters) {
    counts[s.position]++;
  }

  if (counts.GK !== 1) errors.push(`Exactement 1 gardien requis (actuel : ${counts.GK})`);
  if (counts.DEF < 3) errors.push(`Minimum 3 defenseurs requis (actuel : ${counts.DEF})`);
  if (counts.MID < 3) errors.push(`Minimum 3 milieux requis (actuel : ${counts.MID})`);
  if (counts.ATT < 1 || counts.ATT > 3) errors.push(`Entre 1 et 3 attaquants requis (actuel : ${counts.ATT})`);

  return errors;
}

function mapPosition(dbPosition: string): Position {
  const lower = dbPosition.toLowerCase();
  if (lower.includes("gardien")) return "GK";
  if (lower.includes("fense") || lower.includes("défense")) return "DEF";
  if (lower.includes("milieu")) return "MID";
  if (lower.includes("attaq")) return "ATT";
  return "MID";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = (await request.json()) as LineupPayload;
    const { leagueId, day, starters, userId: overrideUserId } = body;

    if (!leagueId || !day || !starters) {
      return NextResponse.json({ error: "Donnees manquantes" }, { status: 400 });
    }

    if (starters.length !== 11) {
      return NextResponse.json({ error: "Exactement 11 titulaires requis" }, { status: 400 });
    }

    const sessionUserId = session.user.userId;

    // Admin override: edit another user's team (past matchdays, etc.)
    let userId = sessionUserId;
    const isAdmin = overrideUserId && overrideUserId !== sessionUserId;
    if (isAdmin) {
      if (!(await isUserAdmin(sessionUserId))) {
        return NextResponse.json({ error: "Acces admin requis" }, { status: 403 });
      }
      userId = overrideUserId;
    }

    // Enforce deadline (skip for admin overrides)
    if (!isAdmin) {
      try {
        const deadlineRes = await fetch(new URL("/api/admin/deadline", request.url).href);
        const deadlineData = await deadlineRes.json();
        if (deadlineData.lockAt) {
          const lockAt = new Date(deadlineData.lockAt);
          if (new Date() >= lockAt) {
            return NextResponse.json(
              { error: `Journee fermee depuis ${lockAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}. Contactez un admin pour modifier.` },
              { status: 403 }
            );
          }
        }
      } catch {
        // Deadline check failed — allow save (fail open, not closed)
      }
    }

    // Verify target user belongs to this league
    const leagueUser = await prisma.leagueUser.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!leagueUser) {
      return NextResponse.json({ error: "Vous n'appartenez pas a cette ligue" }, { status: 403 });
    }

    // Get player positions for validation
    const playerIds = starters.map((s) => s.playerId);
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
    });
    const playerMap = new Map(players.map((p) => [p.id, p]));

    const startersWithPos = starters.map((s) => {
      const player = playerMap.get(s.playerId);
      return {
        playerId: s.playerId,
        position: player ? mapPosition(player.position) : ("MID" as Position),
      };
    });

    const errors = validatePositionConstraints(startersWithPos);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
    }

    // Verify all players belong to the user's team
    const teamPlayers = await prisma.team.findMany({
      where: {
        leagueId,
        userId,
        dayFirst: { lte: day },
        dayLast: { gte: day },
      },
    });
    const teamPlayerIds = new Set(teamPlayers.map((t) => t.playerId));

    for (const s of starters) {
      if (!teamPlayerIds.has(s.playerId)) {
        return NextResponse.json(
          { error: `Le joueur ${s.playerId} ne fait pas partie de votre equipe` },
          { status: 400 }
        );
      }
    }

    const now = new Date();

    // Delete existing lineup for this day, then insert new one
    await prisma.teamDay.deleteMany({
      where: { leagueId, userId, day },
    });

    // Insert all starters
    await prisma.teamDay.createMany({
      data: starters.map((s) => ({
        leagueId,
        userId,
        playerId: s.playerId,
        day,
        indx: s.indx,
        isValid: 1,
        dtSave: now,
        dtValid: now,
      })),
    });

    return NextResponse.json({ success: true, message: "Equipe validee avec succes" });
  } catch (error) {
    console.error("Lineup save error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
