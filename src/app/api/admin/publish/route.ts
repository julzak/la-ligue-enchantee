import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

function dec(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

function mapPosition(dbPosition: string): "GK" | "DEF" | "MID" | "ATT" {
  const lower = dbPosition.toLowerCase();
  if (lower.includes("gardien")) return "GK";
  if (lower.includes("fense")) return "DEF";
  if (lower.includes("milieu")) return "MID";
  if (lower.includes("attaq")) return "ATT";
  return "MID";
}

// POST: publish a matchday (recalculate STATS_USER for all leagues)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { day } = await request.json() as { day: number };
    if (!day) return NextResponse.json({ error: "day required" }, { status: 400 });

    // Get all leagues
    const leagues = await prisma.league.findMany({ where: { id: { gt: 0 } } });

    // Get all scores for this day
    const scores = await prisma.score.findMany({ where: { day } });
    const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

    // Get all players (for position)
    const players = await prisma.player.findMany();
    const playerMap = new Map(players.map((p) => [p.id, p]));

    for (const league of leagues) {
      // Get all participants in this league
      const leagueUsers = await prisma.leagueUser.findMany({
        where: { leagueId: league.id },
      });

      // Get lineups for this day in this league (raw query to avoid DT_VALID crash)
      const teamDays = await prisma.$queryRawUnsafe<{
        userId: number; playerId: number; indx: number;
      }[]>(
        "SELECT ID_USER as userId, ID_PLAYER as playerId, INDX as indx FROM TEAM_DAY WHERE ID_LEAGUE = ? AND DAY = ?",
        league.id, day
      );

      // Group by user
      const userLineups = new Map<number, number[]>();
      teamDays.forEach((td) => {
        const arr = userLineups.get(td.userId) ?? [];
        arr.push(td.playerId);
        userLineups.set(td.userId, arr);
      });

      // If no lineups for this day, use TEAM table to get default squad
      for (const lu of leagueUsers) {
        if (!userLineups.has(lu.userId)) {
          // Try previous day's lineup first (raw query to avoid DT_VALID crash)
          const prevLineup = await prisma.$queryRawUnsafe<{ playerId: number }[]>(
            "SELECT ID_PLAYER as playerId FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY = ?",
            league.id, lu.userId, day - 1
          );
          if (prevLineup.length > 0) {
            userLineups.set(lu.userId, prevLineup.map((t) => Number(t.playerId)));
          } else {
            // Fallback to TEAM table (default squad)
            const teamMembers = await prisma.team.findMany({
              where: {
                leagueId: league.id,
                userId: lu.userId,
                dayFirst: { lte: day },
                dayLast: { gte: day },
                isSubs: 0,
              },
            });
            userLineups.set(lu.userId, teamMembers.slice(0, 11).map((t) => t.playerId));
          }
        }
      }

      // Calculate stats for each participant
      const userStats: {
        userId: number;
        playerUsed: number;
        ptsGk: number;
        ptsDf: number;
        ptsMf: number;
        ptsSt: number;
        ptsPas: number;
        ptsGls: number;
        ptsFrf: number;
        ptsTot: number;
      }[] = [];

      for (const lu of leagueUsers) {
        const lineup = userLineups.get(lu.userId) ?? [];
        let ptsGk = 0, ptsDf = 0, ptsMf = 0, ptsSt = 0;
        let ptsPas = 0, ptsGls = 0, ptsFrf = 0;
        let playerUsed = 0;

        for (const playerId of lineup) {
          const score = scoreMap.get(playerId);
          const player = playerMap.get(playerId);
          if (!score || !player) continue;

          const pos = mapPosition(player.position);
          // Red card: note replaced by 0, bonuses kept
          const pts = score.redCard ? 0 : dec(score.points);
          const goals = score.goals;
          const passes = score.passes;
          // Position-based goal bonus: GK +10, DEF +4, MID/ATT +2
          const goalBonus = pos === "GK" ? 10 : pos === "DEF" ? 4 : 2;
          const total = pts + goalBonus * goals + passes - 2 * (score.ownGoals ?? 0) + 2 * (score.penaltySaved ?? 0);

          playerUsed++;
          ptsFrf += pts;
          ptsPas += passes;
          ptsGls += goals;

          switch (pos) {
            case "GK": ptsGk += total; break;
            case "DEF": ptsDf += total; break;
            case "MID": ptsMf += total; break;
            case "ATT": ptsSt += total; break;
          }
        }

        const ptsTot = ptsGk + ptsDf + ptsMf + ptsSt;

        userStats.push({
          userId: lu.userId,
          playerUsed,
          ptsGk, ptsDf, ptsMf, ptsSt,
          ptsPas, ptsGls, ptsFrf, ptsTot,
        });
      }

      // Sort by ptsTot descending for day rank
      userStats.sort((a, b) => b.ptsTot - a.ptsTot);

      // Calculate cumulative totals for league rank
      const prevStats = await prisma.statsUser.findMany({
        where: { leagueId: league.id, day: { lt: day } },
      });
      const cumulMap = new Map<number, number>();
      prevStats.forEach((s) => {
        cumulMap.set(s.userId, (cumulMap.get(s.userId) ?? 0) + dec(s.ptsTot));
      });

      // Add current day to cumul
      const cumulWithToday = userStats.map((s) => ({
        userId: s.userId,
        cumul: (cumulMap.get(s.userId) ?? 0) + s.ptsTot,
      }));
      cumulWithToday.sort((a, b) => b.cumul - a.cumul);
      const leagueRankMap = new Map(cumulWithToday.map((s, i) => [s.userId, i + 1]));

      // Calculate global rank (across all leagues) - simplified: just use league rank for now
      // Real global rank would need all leagues computed first

      // Parameterized upserts for STATS_USER
      for (let i = 0; i < userStats.length; i++) {
        const s = userStats[i];
        const rankLeague = leagueRankMap.get(s.userId) ?? i + 1;
        await prisma.$executeRawUnsafe(
          `INSERT INTO STATS_USER (ID_USER, ID_LEAGUE, DAY, RANK_DAY, RANK_LEAGUE, RANK_GLOBAL, PLAYER_USED, PTS_GK, PTS_DF, PTS_MF, PTS_ST, PTS_PAS, PTS_GLS, PTS_FRF, PTS_TOT)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE RANK_DAY=VALUES(RANK_DAY), RANK_LEAGUE=VALUES(RANK_LEAGUE), PLAYER_USED=VALUES(PLAYER_USED), PTS_GK=VALUES(PTS_GK), PTS_DF=VALUES(PTS_DF), PTS_MF=VALUES(PTS_MF), PTS_ST=VALUES(PTS_ST), PTS_PAS=VALUES(PTS_PAS), PTS_GLS=VALUES(PTS_GLS), PTS_FRF=VALUES(PTS_FRF), PTS_TOT=VALUES(PTS_TOT)`,
          s.userId, league.id, day, i + 1, rankLeague, s.playerUsed,
          s.ptsGk, s.ptsDf, s.ptsMf, s.ptsSt, s.ptsPas, s.ptsGls, s.ptsFrf, s.ptsTot
        );
      }
    }

    return NextResponse.json({ ok: true, day, message: `Journée ${day} publiée pour ${leagues.length} ligues` });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json({ error: "Erreur publication" }, { status: 500 });
  }
}
