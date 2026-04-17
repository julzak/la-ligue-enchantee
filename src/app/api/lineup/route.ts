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

    // Enforce deadline per match day (skip for admin overrides)
    // Rule: for each day with matches, players from those clubs are locked at 15h
    // (or 2h before kickoff if a match starts before 17h that day)
    if (!isAdmin) {
      try {
        const matches = await prisma.$queryRawUnsafe<{
          home_team: string; away_team: string; match_date: string; match_time: string;
        }[]>(
          "SELECT home_team, away_team, match_date, match_time FROM MATCH_SCHEDULE WHERE matchday = ?",
          day
        );

        if (matches.length > 0) {
          // Get deadline config
          const cfgRows = await prisma.$queryRawUnsafe<{
            deadline_hour: number; early_match_hour: number; early_match_offset_hours: number;
          }[]>(
            "SELECT deadline_hour, early_match_hour, early_match_offset_hours FROM SCORING_CONFIG WHERE season = '2025-2026' LIMIT 1"
          );
          const cfg = cfgRows[0] ?? { deadline_hour: 15, early_match_hour: 17, early_match_offset_hours: 2 };

          // Group matches by date, compute deadline per date
          const byDate = new Map<string, { teams: Set<string>; earliestTime: string }>();
          for (const m of matches) {
            const date = String(m.match_date).slice(0, 10);
            const time = String(m.match_time || "20:00:00").slice(0, 5);
            if (!byDate.has(date)) byDate.set(date, { teams: new Set(), earliestTime: time });
            const entry = byDate.get(date)!;
            entry.teams.add(m.home_team);
            entry.teams.add(m.away_team);
            if (time < entry.earliestTime) entry.earliestTime = time;
          }

          // Map club IDs to team names for the starters
          const starterPlayerIds = starters.map((s: StarterEntry) => s.playerId);
          const starterPlayers = await prisma.player.findMany({
            where: { id: { in: starterPlayerIds } },
            select: { id: true, clubId: true },
          });
          const clubIds = Array.from(new Set(starterPlayers.map((p) => p.clubId)));
          const clubs = await prisma.club.findMany({
            where: { id: { in: clubIds } },
            select: { id: true, name: true },
          });
          const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));
          const playerClubName = new Map(starterPlayers.map((p) => [p.id, clubNameById.get(p.clubId) ?? ""]));

          // Check each date: if deadline passed, block players from those clubs
          const now = new Date();
          const lockedPlayers: string[] = [];

          for (const [date, { teams, earliestTime }] of byDate) {
            const kickoffHour = parseInt(earliestTime.split(":")[0]);
            let deadlineHour = cfg.deadline_hour;
            if (kickoffHour < cfg.early_match_hour) {
              deadlineHour = kickoffHour - cfg.early_match_offset_hours;
            }
            const deadlineUtcHour = deadlineHour - 2; // Paris = UTC+2
            const deadline = new Date(`${date}T${String(deadlineUtcHour).padStart(2, "0")}:00:00Z`);

            if (now >= deadline) {
              // This day's matches are locked — check if any starter belongs to these clubs
              for (const [, clubName] of playerClubName) {
                if (teams.has(clubName)) {
                  lockedPlayers.push(clubName);
                }
              }
            }
          }

          if (lockedPlayers.length > 0) {
            const uniqueClubs = [...new Set(lockedPlayers)];
            return NextResponse.json(
              { error: `Impossible de modifier : les joueurs de ${uniqueClubs.join(", ")} sont bloques (match en cours ou passe). Contactez un admin.` },
              { status: 403 }
            );
          }
        }
      } catch {
        // Deadline check failed — allow save (fail open)
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
