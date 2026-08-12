import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasonFilters } from "@/lib/season";
import { buildDayScoreResolver } from "@/lib/club-goalkeeper";
import { getScoringConfig } from "@/lib/scoring-config";
import { computePlayerTotal, baseNoteAfterRedCard } from "@/lib/scoring-core";
import { leagueSlug } from "@/lib/season-key";
import { generateTopo } from "@/lib/topo";

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

    // Leagues/players de la saison courante (fallback legacy si non scopé)
    const filters = await getSeasonFilters();
    const leagues = await prisma.league.findMany({ where: filters.league });

    // Get all scores for this day
    const scores = await prisma.score.findMany({ where: { day } });

    // Get all players (for position)
    const players = await prisma.player.findMany({ where: filters.player });
    const playerMap = new Map(players.map((p) => [p.id, p]));

    // Résolution des notes : pour un pseudo-gardien « Gardiens [Club] », la
    // ligne SCORE utilisée est celle du gardien nommé aligné par son club ce
    // jour-là ; pour tout autre joueur, sa propre ligne (inchangé). Pas de
    // ligne résoluble = pas de points, comme tout joueur sans note.
    // Cf docs/regles-encheres.md §7 (décision 2026-06-10).
    const resolveScore = buildDayScoreResolver(players, scores);

    // Bareme : lu depuis SCORING_CONFIG (source unique de verite, partagee avec
    // l'affichage). Auparavant code en dur ici : editer le bareme faisait diverger
    // classement (STATS_USER) et fiches joueurs. Defaut = bareme historique.
    const cfg = await getScoringConfig();

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
          const score = resolveScore(playerId);
          const player = playerMap.get(playerId);
          if (!score || !player) continue;

          const pos = mapPosition(player.position);
          const goals = score.goals;
          const passes = score.passes;
          const redCard = Boolean(score.redCard);
          // Note de base (carton rouge -> 0 si redCardNoteZero, bonus conserves)
          // et total, calcules par le socle partage avec le bareme configurable.
          const pts = baseNoteAfterRedCard(dec(score.points), redCard, cfg);
          const total = computePlayerTotal(
            { points: dec(score.points), goals, passes, position: pos, redCard,
              ownGoals: score.ownGoals ?? 0, penaltySaved: score.penaltySaved ?? 0 },
            cfg
          );

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

    // Génération automatique des synthèses Lia (remplace le déclenchement manuel).
    // En tâche de fond et ESPACÉ : le free tier de Gemini 2.5 Pro plafonne à ~2
    // requêtes/minute. On génère les ligues séquentiellement avec un délai pour
    // qu'elles passent (presque) toutes sur Pro plutôt que de retomber sur Flash.
    // Ne bloque JAMAIS la réponse de publication ; un échec est loggé, pas propagé.
    const slugsToGenerate = leagues.map((l) => leagueSlug(l.name));
    void (async () => {
      for (let i = 0; i < slugsToGenerate.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 35_000)); // respect du quota Pro
        try {
          await generateTopo(slugsToGenerate[i], true);
          console.log(`[publish] synthèse Lia générée: ${slugsToGenerate[i]} (J${day})`);
        } catch (e) {
          console.error(`[publish] synthèse Lia échouée (${slugsToGenerate[i]}):`, (e as Error).message);
        }
      }
    })();

    return NextResponse.json({ ok: true, day, message: `Journée ${day} publiée pour ${leagues.length} ligues` });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json({ error: "Erreur publication" }, { status: 500 });
  }
}
