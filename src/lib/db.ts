import { cache } from "react";
import { prisma } from "./prisma";
import type { Decimal } from "@prisma/client/runtime/library";
import { getClubLogoUrl, getClubShortName, getClubIdByTeamName } from "./assets";
import { getScoringConfig, goalBonusForPosition, type ScoringConfig } from "./scoring-config";
import { getSeasonScope, getCurrentSeasonKey } from "./season";
import { leagueSlug } from "./season-key";

// ── Request-scoped caches (dedup within same render) ────
// Scopées sur la saison courante quand elle a des données rattachées,
// sinon fallback legacy non scopé (données historiques seasonId NULL).
const getCachedClubs = cache(async () => {
  const scope = await getSeasonScope();
  const clubs = await prisma.club.findMany(
    scope.season && scope.hasClubs ? { where: { seasonId: scope.season.id } } : undefined
  );
  return new Map(clubs.map((c) => [c.id, c]));
});

const getCachedClubNames = cache(async () => {
  const clubs = await getCachedClubs();
  return new Map(Array.from(clubs.values()).map((c) => [c.id, c.name]));
});

const getCachedPlayers = cache(async () => {
  const scope = await getSeasonScope();
  const players = await prisma.player.findMany(
    scope.season && scope.hasPlayers ? { where: { seasonId: scope.season.id } } : undefined
  );
  return new Map(players.map((p) => [p.id, p]));
});

// ── Helpers ───────────────────────────────────────────────
function dec(v: Decimal | number | null): number {
  if (v === null) return 0;
  return typeof v === "number" ? v : Number(v);
}

// ── Scoring formula (config-driven) ─────────────────────
function calcPlayerTotal(
  points: number, goals: number, passes: number, position: string,
  redCard = 0, ownGoals = 0, penaltySaved = 0,
  cfg?: ScoringConfig
): number {
  const base = redCard ? 0 : points;
  const gb = cfg ? goalBonusForPosition(position, cfg) : goalBonusForPositionDefault(position);
  const cscPenalty = cfg ? cfg.cscMalus : -2;
  const penBonus = cfg ? cfg.penaltySavedBonus : 2;
  return Math.max(0, base + gb * goals + passes + cscPenalty * ownGoals + penBonus * penaltySaved);
}

// Fallback for when config isn't loaded yet (should not happen in practice)
function goalBonusForPositionDefault(position: string): number {
  const p = position.toLowerCase();
  if (p.includes("gardien")) return 10;
  if (p.includes("fense")) return 4;
  return 2;
}

// Trophy types from the img tags in USER.NAME
type TrophyType = "star" | "star-gold" | "star-red" | "cup" | "skull" | "leaf" | "ballon-dor";

interface ParsedUser {
  id: number;
  cleanName: string;
  trophies: TrophyType[];
  email: string;
}

function parseUserName(raw: string): { cleanName: string; trophies: TrophyType[] } {
  const trophies: TrophyType[] = [];
  const imgRegex = /<img[^>]*src="[^"]*?(\w+)\.(gif|png)"[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(raw)) !== null) {
    const filename = match[1].toLowerCase();
    if (filename === "etoile_jaune" || filename === "etoile_or") trophies.push("star-gold");
    else if (filename === "etoile_rouge" || filename === "etoile") trophies.push("star-red");
    else if (filename === "etoile_noire") trophies.push("star");
    else if (filename === "etoile_verte") trophies.push("star-gold");
    else if (filename === "coupe" || filename === "trophee") trophies.push("cup");
    else if (filename === "skull" || filename === "tete_mort") trophies.push("skull");
    else if (filename === "champion_automne") trophies.push("leaf");
    else if (filename === "ballon_dor") trophies.push("ballon-dor");
    else trophies.push("star"); // fallback
  }
  const cleanName = raw.replace(/<[^>]*>/g, "").trim();
  return { cleanName, trophies };
}

function getInitials(name: string): string {
  return name
    .split(/[\s/]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Position mapping from DB format to our format
type Position = "GK" | "DEF" | "MID" | "ATT";

function mapPosition(dbPosition: string): Position {
  const lower = dbPosition.toLowerCase();
  if (lower.includes("gardien")) return "GK";
  if (lower.includes("fense") || lower.includes("défense")) return "DEF";
  if (lower.includes("milieu")) return "MID";
  if (lower.includes("attaq")) return "ATT";
  return "MID"; // fallback
}

// ── Leagues ───────────────────────────────────────────────
export async function getLeagues() {
  const scope = await getSeasonScope();
  const leagues =
    scope.season && scope.hasLeagues
      ? await prisma.league.findMany({
          where: { seasonId: scope.season.id },
          orderBy: [{ tier: "asc" }, { id: "asc" }],
        })
      : await prisma.league.findMany({
          where: { id: { gt: 0 } }, // exclude legacy league 0
          orderBy: { id: "asc" },
        });
  return leagues.map((l) => ({
    id: l.id,
    slug: leagueSlug(l.name),
    name: l.name,
    dbId: l.id,
  }));
}

export async function getLeagueBySlug(slug: string) {
  const leagues = await getLeagues();
  return leagues.find((l) => l.slug === slug) ?? null;
}

// ── Participants (users in a league) ──────────────────────
export async function getLeagueParticipants(leagueDbId: number): Promise<ParsedUser[]> {
  const leagueUsers = await prisma.leagueUser.findMany({
    where: { leagueId: leagueDbId },
  });
  const userIds = leagueUsers.map((lu) => lu.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });
  return users.map((u) => {
    const { cleanName, trophies } = parseUserName(u.name);
    return { id: u.id, cleanName, trophies, email: u.email };
  });
}

export async function getUserById(userId: number): Promise<ParsedUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const { cleanName, trophies } = parseUserName(user.name);
  return { id: user.id, cleanName, trophies, email: user.email };
}

// ── Current matchday ──────────────────────────────────────
export async function getCurrentMatchday(): Promise<number> {
  const scope = await getSeasonScope();
  if (scope.season && scope.hasPlayers) {
    // Saison scopée : seule la progression des joueurs de la saison compte.
    // SCORE n'a pas de relation Prisma vers PLAYER (tables MyISAM) -> SQL brut.
    const rows = await prisma.$queryRawUnsafe<{ maxDay: number | null }[]>(
      "SELECT MAX(s.DAY) AS maxDay FROM SCORE s JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER WHERE p.ID_SEASON = ?",
      scope.season.id
    );
    const maxDay = rows[0]?.maxDay;
    return maxDay != null ? Number(maxDay) : 1;
  }
  const latest = await prisma.score.findFirst({ orderBy: { day: "desc" } });
  return latest?.day ?? 1;
}

// ── Locked clubs for a matchday ─────────────────────────
// Retourne les clubIds dont la deadline de saisie d'equipe est passee
// pour la journee donnee. Logique cote serveur uniquement (utilise
// par /api/lineup pour bloquer les modifs et par /mon-equipe pour
// griser les joueurs concernes cote UI).
//
// Regles :
//   - Match reporte non joue (is_postponed=1 AND home_score IS NULL) :
//     - sans admin_override_date : exclu du calcul, club non locke
//     - avec admin_override_date : deadline calculee sur cette nouvelle date
//   - Sinon : deadline calculee sur match_date
//   - Deadline = SCORING_CONFIG.deadline_hour (15h Paris par defaut),
//     avancee a (heure_match - early_match_offset_hours) si match avant
//     early_match_hour (17h)
export async function getLockedClubIds(day: number): Promise<Set<number>> {
  const seasonKey = await getCurrentSeasonKey();
  const matches = await prisma.$queryRawUnsafe<{
    home_team: string; away_team: string; match_date: string; match_time: string;
    is_postponed: number | null; admin_override_date: string | null; home_score: number | null;
  }[]>(
    "SELECT home_team, away_team, match_date, match_time, is_postponed, admin_override_date, home_score FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ?",
    seasonKey, day
  );

  if (matches.length === 0) return new Set();

  const cfgRows = await prisma.$queryRawUnsafe<{
    deadline_hour: number; early_match_hour: number; early_match_offset_hours: number;
  }[]>(
    "SELECT deadline_hour, early_match_hour, early_match_offset_hours FROM SCORING_CONFIG WHERE season = ? LIMIT 1",
    seasonKey
  );
  const cfg = cfgRows[0] ?? { deadline_hour: 15, early_match_hour: 17, early_match_offset_hours: 2 };

  const byDate = new Map<string, { clubIds: Set<number>; earliestHour: number }>();
  for (const m of matches) {
    const isUnplayedPostponed = m.is_postponed === 1 && m.home_score === null;
    let effectiveDate: Date;
    if (isUnplayedPostponed) {
      if (!m.admin_override_date) continue;
      effectiveDate = new Date(m.admin_override_date as unknown as string);
    } else {
      effectiveDate = new Date(m.match_date as unknown as string);
    }
    const date = effectiveDate.toISOString().slice(0, 10);
    const timeObj = m.match_time ? new Date(m.match_time as unknown as string) : null;
    const hour = timeObj ? timeObj.getUTCHours() + 2 : 20; // stored as UTC, Paris = +2
    const homeId = getClubIdByTeamName(m.home_team);
    const awayId = getClubIdByTeamName(m.away_team);
    if (homeId === null || awayId === null) {
      console.warn(`[getLockedClubIds] Unknown team J${day}: "${m.home_team}" / "${m.away_team}"`);
      continue;
    }
    if (!byDate.has(date)) byDate.set(date, { clubIds: new Set(), earliestHour: hour });
    const entry = byDate.get(date)!;
    entry.clubIds.add(homeId);
    entry.clubIds.add(awayId);
    if (hour < entry.earliestHour) entry.earliestHour = hour;
  }

  const now = new Date();
  const lockedClubIds = new Set<number>();
  for (const [date, { clubIds, earliestHour }] of Array.from(byDate.entries())) {
    let deadlineHour = Number(cfg.deadline_hour);
    if (earliestHour < Number(cfg.early_match_hour)) {
      deadlineHour = earliestHour - Number(cfg.early_match_offset_hours);
    }
    const deadlineUtcHour = deadlineHour - 2; // Paris = UTC+2
    const deadline = new Date(`${date}T${String(Math.max(0, deadlineUtcHour)).padStart(2, "0")}:00:00Z`);
    if (now >= deadline) {
      clubIds.forEach((id) => lockedClubIds.add(id));
    }
  }

  return lockedClubIds;
}

// ── Standings (from STATS_USER) ───────────────────────────
export interface StandingRow {
  userId: number;
  userName: string;
  trophies: TrophyType[];
  initials: string;
  rank: number;
  totalPoints: number;
  lastMatchdayPoints: number;
  ptsPerDay: number;
  delta: number; // rank change vs previous day
  ptsGk: number;
  ptsDf: number;
  ptsMf: number;
  ptsSt: number;
  ptsPas: number;
  ptsGls: number;
}

export async function getLeagueStandings(leagueDbId: number, day?: number) {
  const currentDay = day ?? await getCurrentMatchday();
  const participants = await getLeagueParticipants(leagueDbId);
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // PTS_TOT in STATS_USER is PER-DAY score (not cumulative!)
  // We need to sum all days to get the cumulative total
  const allStats = await prisma.statsUser.findMany({
    where: { leagueId: leagueDbId, day: { lte: currentDay } },
  });

  // Build cumulative totals per user
  const cumulMap = new Map<number, { total: number; ptsGk: number; ptsDf: number; ptsMf: number; ptsSt: number; ptsPas: number; ptsGls: number }>();
  allStats.forEach((s) => {
    const prev = cumulMap.get(s.userId) ?? { total: 0, ptsGk: 0, ptsDf: 0, ptsMf: 0, ptsSt: 0, ptsPas: 0, ptsGls: 0 };
    cumulMap.set(s.userId, {
      total: prev.total + dec(s.ptsTot),
      ptsGk: prev.ptsGk + dec(s.ptsGk),
      ptsDf: prev.ptsDf + dec(s.ptsDf),
      ptsMf: prev.ptsMf + dec(s.ptsMf),
      ptsSt: prev.ptsSt + dec(s.ptsSt),
      ptsPas: prev.ptsPas + s.ptsPas,
      ptsGls: prev.ptsGls + s.ptsGls,
    });
  });

  // Get current day stats for per-day score and rank
  const todayStats = allStats.filter((s) => s.day === currentDay);

  // Sort by cumulative total descending to get current cumulative rank
  const sortedUsers = Array.from(cumulMap.entries())
    .sort((a, b) => b[1].total - a[1].total);

  // Compute previous day cumulative totals to get previous cumulative rank
  const prevCumulMap = new Map<number, number>();
  allStats.filter((s) => s.day < currentDay).forEach((s) => {
    prevCumulMap.set(s.userId, (prevCumulMap.get(s.userId) ?? 0) + dec(s.ptsTot));
  });
  const prevSorted = Array.from(prevCumulMap.entries())
    .sort((a, b) => b[1] - a[1]);
  const prevRankMap = new Map(prevSorted.map(([userId], i) => [userId, i + 1]));

  const standings: StandingRow[] = sortedUsers.map(([userId, cumul], i) => {
    const user = participantMap.get(userId);
    const todayStat = todayStats.find((s) => s.userId === userId);
    const currentRank = i + 1; // rank from cumulative sort
    const prevRank = prevRankMap.get(userId) ?? currentRank;

    return {
      userId,
      userName: user?.cleanName ?? `User ${userId}`,
      trophies: user?.trophies ?? [],
      initials: user ? getInitials(user.cleanName) : "??",
      rank: currentRank,
      totalPoints: Math.round(cumul.total * 10) / 10,
      lastMatchdayPoints: todayStat ? dec(todayStat.ptsTot) : 0,
      ptsPerDay: currentDay > 0 ? Math.round(cumul.total / currentDay * 100) / 100 : 0,
      delta: prevRank - currentRank,
      ptsGk: Math.round(cumul.ptsGk * 10) / 10,
      ptsDf: Math.round(cumul.ptsDf * 10) / 10,
      ptsMf: Math.round(cumul.ptsMf * 10) / 10,
      ptsSt: Math.round(cumul.ptsSt * 10) / 10,
      ptsPas: cumul.ptsPas,
      ptsGls: cumul.ptsGls,
    };
  });

  // League totals
  const totalPoints = standings.reduce((sum, s) => sum + s.totalPoints, 0);
  const pointsJournee = standings.reduce((sum, s) => sum + s.lastMatchdayPoints, 0);

  return {
    standings,
    totalPoints,
    pointsJournee,
    ratio: standings.length > 0 ? pointsJournee / standings.length : 0,
    currentDay,
  };
}

// ── Interleague standings ─────────────────────────────────
export async function getInterleagueStandings(day?: number) {
  const currentDay = day ?? await getCurrentMatchday();
  const leagues = await getLeagues();

  // PTS_TOT is per-day, need to sum all days for cumulative
  const allStats = await prisma.statsUser.findMany({
    where: { leagueId: { gt: 0 }, day: { lte: currentDay } },
  });

  // Build cumulative totals per user+league
  const cumulMap = new Map<string, { userId: number; leagueId: number; total: number }>();
  allStats.forEach((s) => {
    const key = `${s.userId}-${s.leagueId}`;
    const prev = cumulMap.get(key);
    cumulMap.set(key, {
      userId: s.userId,
      leagueId: s.leagueId,
      total: (prev?.total ?? 0) + dec(s.ptsTot),
    });
  });

  // Sort by total and take top 20
  const sorted = Array.from(cumulMap.values())
    .sort((a, b) => b.total - a.total)
    ;

  const userIds = sorted.map((s) => s.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map((u) => {
    const { cleanName, trophies } = parseUserName(u.name);
    return [u.id, { cleanName, trophies }];
  }));

  const leagueMap = new Map(leagues.map((l) => [l.dbId, l.name]));

  return sorted.map((s, i) => {
    const user = userMap.get(s.userId);
    return {
      rank: i + 1,
      userId: s.userId,
      userName: user?.cleanName ?? `User ${s.userId}`,
      trophies: user?.trophies ?? [],
      leagueName: leagueMap.get(s.leagueId) ?? "?",
      leagueSlug: leagues.find((l) => l.dbId === s.leagueId)?.slug ?? "ligue-1",
      totalPoints: Math.round(s.total * 10) / 10,
    };
  });
}

// ── Day stats (homepage) ──────────────────────────────────
interface AggRow { totalGoals: number; totalPoints: number; playerCount: number; }

async function aggregateScoresSQL(dayFilter?: number): Promise<AggRow> {
  const whereClause = dayFilter != null ? `WHERE s.DAY = ${Number(dayFilter)}` : "";
  const rows = await prisma.$queryRawUnsafe<AggRow[]>(`
    SELECT
      COALESCE(SUM(s.GOALS), 0) AS totalGoals,
      COALESCE(SUM(
        CASE WHEN s.RED_CARD > 0 THEN 0 ELSE s.POINTS END
        + CASE
            WHEN p.POSITION LIKE '%gardien%' THEN 10 * s.GOALS
            WHEN p.POSITION LIKE '%fense%' OR p.POSITION LIKE '%défense%' THEN 4 * s.GOALS
            ELSE 2 * s.GOALS END
        + s.PASSES
        - 2 * s.OWN_GOALS
        + 2 * s.PENALTY_SAVED
      ), 0) AS totalPoints,
      COUNT(CASE WHEN s.USED > 0 THEN 1 END) AS playerCount
    FROM SCORE s
    JOIN PLAYER p ON s.ID_PLAYER = p.ID_PLAYER
    ${whereClause}
  `);
  const r = rows[0];
  return { totalGoals: Number(r.totalGoals), totalPoints: Number(r.totalPoints), playerCount: Number(r.playerCount) };
}

export async function getDayStats(day?: number) {
  const currentDay = day ?? await getCurrentMatchday();

  const [dayAgg, seasonAgg] = await Promise.all([
    aggregateScoresSQL(currentDay),
    aggregateScoresSQL(),
  ]);

  return {
    totalGoals: dayAgg.totalGoals,
    totalPoints: Math.round(dayAgg.totalPoints * 10) / 10,
    avgPerPlayer: dayAgg.playerCount > 0 ? Math.round(dayAgg.totalPoints / dayAgg.playerCount * 100) / 100 : 0,
    currentDay,
    seasonAvgGoals: currentDay > 0 ? Math.round(seasonAgg.totalGoals / currentDay * 10) / 10 : 0,
    seasonAvgPoints: currentDay > 0 ? Math.round(seasonAgg.totalPoints / currentDay) : 0,
    seasonAvgPerPlayer: seasonAgg.playerCount > 0 ? Math.round(seasonAgg.totalPoints / seasonAgg.playerCount * 100) / 100 : 0,
  };
}

// ── Best performances of the day ──────────────────────────
export async function getBestPerformances(day?: number, limit = 5) {
  const currentDay = day ?? await getCurrentMatchday();
  const scoringCfg = await getScoringConfig();

  const scores = await prisma.score.findMany({
    where: { day: currentDay, used: { gt: 0 } },
    orderBy: [{ goals: "desc" }, { passes: "desc" }, { points: "desc" }],
    take: 50,
  });

  // Need player info
  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubNames();

  // Sort by total points (POINTS + 2*GOALS + PASSES)
  const ranked = scores
    .map((s) => {
      const player = playerMap.get(s.playerId);
      const pos = player?.position ?? "";
      const total = calcPlayerTotal(dec(s.points), s.goals, s.passes, pos, s.redCard, s.ownGoals, s.penaltySaved, scoringCfg);
      const details: string[] = [];
      if (s.goals > 0) details.push(`${s.goals} but${s.goals > 1 ? "s" : ""}`);
      if (s.passes > 0) details.push(`${s.passes} passe${s.passes > 1 ? "s" : ""}`);
      if (s.redCard) details.push("🟥");
      if (s.ownGoals > 0) details.push(`${s.ownGoals} csc`);
      if (s.penaltySaved > 0) details.push(`${s.penaltySaved} pen arr.`);
      details.push(`${dec(s.points)} pts`);

      return {
        playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${s.playerId}`,
        club: player ? (clubMap.get(player.clubId) ?? "") : "",
        points: Math.round(total * 10) / 10,
        detail: details.join(", "),
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);

  return ranked;
}

// ── Worst performances (Onze des Saucisses) ───────────────
export async function getWorstPerformances(day?: number, limit = 5) {
  const currentDay = day ?? await getCurrentMatchday();
  const scoringCfg = await getScoringConfig();

  const scores = await prisma.score.findMany({
    where: { day: currentDay, used: { gt: 0 } },
    take: 500,
  });

  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubNames();

  const ranked = scores
    .filter((s) => {
      // Exclude forfait/bench players (2 pts base = didn't actually play)
      // L'Équipe almost never gives 2/10, so 2 = forfait in practice
      const pts = dec(s.points);
      return pts > 0 && pts !== 2;
    })
    .map((s) => {
      const player = playerMap.get(s.playerId);
      const pos = player?.position ?? "";
      const total = calcPlayerTotal(dec(s.points), s.goals, s.passes, pos, s.redCard, s.ownGoals, s.penaltySaved, scoringCfg);
      return {
        playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${s.playerId}`,
        club: player ? (clubMap.get(player.clubId) ?? "") : "",
        points: Math.round(total * 10) / 10,
        detail: `${dec(s.points)} pts`,
      };
    })
    .sort((a, b) => a.points - b.points)
    .slice(0, limit);

  return ranked;
}

// ── Player squad (team) for a participant ─────────────────
export async function getParticipantTeam(leagueDbId: number, userId: number, day?: number) {
  const currentDay = day ?? await getCurrentMatchday();

  // Get active squad members
  const teamMembers = await prisma.team.findMany({
    where: {
      leagueId: leagueDbId,
      userId,
      dayFirst: { lte: currentDay },
      dayLast: { gte: currentDay },
    },
  });

  // Get lineup for this day (fallback to most recent saved lineup)
  let lineup = await prisma.teamDay.findMany({
    where: { leagueId: leagueDbId, userId, day: currentDay },
    orderBy: { indx: "asc" },
  });
  if (lineup.length === 0 && currentDay > 1) {
    // Find the most recent day with a saved lineup
    const lastSaved = await prisma.$queryRawUnsafe<{ DAY: number }[]>(
      "SELECT DISTINCT DAY FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY < ? ORDER BY DAY DESC LIMIT 1",
      leagueDbId, userId, currentDay
    );
    if (lastSaved.length > 0) {
      lineup = await prisma.teamDay.findMany({
        where: { leagueId: leagueDbId, userId, day: Number(lastSaved[0].DAY) },
        orderBy: { indx: "asc" },
      });
    }
  }

  // Filter lineup to only include players still in the active squad
  // (handles joker swaps where fallback lineup from day-1 has stale players)
  const activePlayerIds = new Set(teamMembers.map((t) => t.playerId));
  const validLineup = lineup.filter((l) => activePlayerIds.has(l.playerId));
  const lineupPlayerIds = new Set(validLineup.map((l) => l.playerId));

  // Get player details
  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubs();

  // Deduplicate by playerId (a player can have multiple periods, e.g., J3-J7 + J21-J34)
  const seenPlayers = new Set<number>();
  return teamMembers
    .filter((t) => {
      if (!playerMap.has(t.playerId)) return false; // Hide ghost players
      if (seenPlayers.has(t.playerId)) return false; // Deduplicate
      seenPlayers.add(t.playerId);
      return true;
    })
    .map((t) => {
    const player = playerMap.get(t.playerId)!;
    const club = clubMap.get(player.clubId) ?? null;
    const isStarter = lineupPlayerIds.has(t.playerId);
    const lineupEntry = lineup.find((l) => l.playerId === t.playerId);

    return {
      playerId: t.playerId,
      playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${t.playerId}`,
      position: player ? mapPosition(player.position) : "MID" as Position,
      clubName: club?.name ?? "",
      clubShort: getClubShortName(player?.clubId ?? 0, club?.name),
      clubLogo: getClubLogoUrl(player?.clubId ?? 0),
      clubId: player?.clubId ?? 0,
      isStarter,
      indx: lineupEntry?.indx ?? 99,
      isSubs: t.isSubs === 1,
      dayFirst: t.dayFirst,
      dayLast: t.dayLast,
    };
  }).sort((a, b) => a.indx - b.indx);
}

// ── Former players (joker exits) ─────────────────────────
export async function getFormerPlayers(leagueDbId: number, userId: number, day?: number) {
  const currentDay = day ?? await getCurrentMatchday();

  const former = await prisma.team.findMany({
    where: {
      leagueId: leagueDbId,
      userId,
      dayLast: { lt: currentDay },
    },
  });

  if (former.length === 0) return [];

  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubs();

  return former.map((t) => {
    const player = playerMap.get(t.playerId);
    const club = player ? clubMap.get(player.clubId) : null;
    return {
      playerId: t.playerId,
      playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${t.playerId}`,
      position: player ? mapPosition(player.position) : "MID" as Position,
      clubShort: getClubShortName(player?.clubId ?? 0, club?.name),
      clubLogo: getClubLogoUrl(player?.clubId ?? 0),
      dayFirst: t.dayFirst,
      dayLast: t.dayLast,
    };
  });
}

// ── Player scores for a participant on a specific day ─────
export async function getParticipantDayScores(leagueDbId: number, userId: number, day: number) {
  const scoringCfg = await getScoringConfig();
  let lineup = await prisma.teamDay.findMany({
    where: { leagueId: leagueDbId, userId, day },
    orderBy: { indx: "asc" },
  });

  // Fallback: if no lineup for this day, try previous day (same logic as publish)
  if (lineup.length === 0 && day > 1) {
    lineup = await prisma.teamDay.findMany({
      where: { leagueId: leagueDbId, userId, day: day - 1 },
      orderBy: { indx: "asc" },
    });
  }

  const playerIds = lineup.map((l) => l.playerId);
  const scores = await prisma.score.findMany({
    where: { day, playerId: { in: playerIds } },
  });
  const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubNames();

  return lineup.map((l) => {
    const player = playerMap.get(l.playerId);
    const score = scoreMap.get(l.playerId);
    const pos = player?.position ?? "";
    const total = score
      ? calcPlayerTotal(dec(score.points), score.goals, score.passes, pos, score.redCard, score.ownGoals, score.penaltySaved, scoringCfg)
      : 0; // pas de score = pas joué (forfait 2 pts uniquement si saisi manuellement par un admin)

    return {
      playerId: l.playerId,
      playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${l.playerId}`,
      position: player ? mapPosition(player.position) : "MID" as Position,
      clubName: player ? (clubMap.get(player.clubId) ?? "") : "",
      clubShort: getClubShortName(player?.clubId ?? 0),
      clubLogo: getClubLogoUrl(player?.clubId ?? 0),
      indx: l.indx,
      rating: score ? dec(score.points) : null,
      goals: score?.goals ?? 0,
      passes: score?.passes ?? 0,
      redCard: (score?.redCard ?? 0) > 0,
      total: Math.round(total * 10) / 10,
    };
  });
}

// ── Scores for all roster players on a specific day ──────
// Unlike getParticipantDayScores (lineup-based), this fetches scores
// for ALL roster players so bench players also show their L'Equipe rating.
export async function getRosterDayScores(rosterPlayerIds: number[], day: number) {
  if (rosterPlayerIds.length === 0) return [];
  const scoringCfg = await getScoringConfig();

  const scores = await prisma.score.findMany({
    where: { day, playerId: { in: rosterPlayerIds } },
  });
  const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubNames();

  return rosterPlayerIds
    .filter((id) => scoreMap.has(id)) // only players with scores
    .map((id) => {
      const player = playerMap.get(id);
      const score = scoreMap.get(id)!;
      const pos = player?.position ?? "";
      const total = calcPlayerTotal(
        dec(score.points), score.goals, score.passes, pos,
        score.redCard, score.ownGoals, score.penaltySaved, scoringCfg
      );

      return {
        playerId: id,
        playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${id}`,
        position: player ? mapPosition(player.position) : "MID" as Position,
        clubName: player ? (clubMap.get(player.clubId) ?? "") : "",
        indx: 0,
        rating: dec(score.points),
        goals: score.goals,
        passes: score.passes,
        total: Math.round(total * 10) / 10,
      };
    });
}

// ── Cumulative player stats for a participant ─────────────
export async function getParticipantCumulativeStats(leagueDbId: number, userId: number, upToDay?: number) {
  const currentDay = upToDay ?? await getCurrentMatchday();
  const scoringCfg = await getScoringConfig();

  // Get all days this participant had a lineup
  const allLineups = await prisma.teamDay.findMany({
    where: { leagueId: leagueDbId, userId, day: { lte: currentDay } },
  });

  // Get unique player IDs
  const playerIds = Array.from(new Set(allLineups.map((l) => l.playerId)));

  // Get all scores for these players up to current day
  const allScores = await prisma.score.findMany({
    where: { playerId: { in: playerIds }, day: { lte: currentDay } },
  });

  // Get player details
  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubNames();

  // Build per-player: which days were they in the lineup?
  const playerDays = new Map<number, Set<number>>();
  allLineups.forEach((l) => {
    const days = playerDays.get(l.playerId) ?? new Set();
    days.add(l.day);
    playerDays.set(l.playerId, days);
  });

  // Aggregate scores only for days the player was in the lineup
  const scoresByPlayer = new Map<number, { notes: number; goals: number; passes: number; total: number; daysPlayed: number }>();
  allScores.forEach((s) => {
    const days = playerDays.get(s.playerId);
    if (!days || !days.has(s.day)) return;

    const prev = scoresByPlayer.get(s.playerId) ?? { notes: 0, goals: 0, passes: 0, total: 0, daysPlayed: 0 };
    const pts = dec(s.points);
    const player = playerMap.get(s.playerId);
    const pos = player?.position ?? "";
    const dayTotal = calcPlayerTotal(pts, s.goals, s.passes, pos, s.redCard, s.ownGoals, s.penaltySaved, scoringCfg);
    scoresByPlayer.set(s.playerId, {
      notes: prev.notes + pts,
      goals: prev.goals + s.goals,
      passes: prev.passes + s.passes,
      total: prev.total + dayTotal,
      daysPlayed: prev.daysPlayed + 1,
    });
  });

  return playerIds.map((playerId) => {
    const player = playerMap.get(playerId);
    const stats = scoresByPlayer.get(playerId) ?? { notes: 0, goals: 0, passes: 0, total: 0, daysPlayed: 0 };
    const daysInLineup = playerDays.get(playerId)?.size ?? 0;

    return {
      playerId,
      playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${playerId}`,
      position: player ? mapPosition(player.position) : "MID" as Position,
      clubName: player ? (clubMap.get(player.clubId) ?? "") : "",
      clubShort: getClubShortName(player?.clubId ?? 0),
      clubLogo: getClubLogoUrl(player?.clubId ?? 0),
      daysPlayed: stats.daysPlayed,
      daysInLineup,
      notes: Math.round(stats.notes * 10) / 10,
      goals: stats.goals,
      passes: stats.passes,
      total: Math.round(stats.total * 10) / 10,
      ratio: daysInLineup > 0 ? Math.round(stats.total / daysInLineup * 100) / 100 : 0,
    };
  });
}

// ── Clubs with player counts ──────────────────────────────
export async function getClubsWithStats(leagueDbId: number, day?: number) {
  const currentDay = day ?? await getCurrentMatchday();
  const allClubs = await getCachedClubs();
  const clubs = Array.from(allClubs.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Get all players per club
  const allPlayers = await getCachedPlayers();
  const players = Array.from(allPlayers.values());
  const playersByClub = new Map<number, typeof players>();
  players.forEach((p) => {
    const arr = playersByClub.get(p.clubId) || [];
    arr.push(p);
    playersByClub.set(p.clubId, arr);
  });

  // Get taken players in this league
  const takenTeams = await prisma.team.findMany({
    where: {
      leagueId: leagueDbId,
      dayFirst: { lte: currentDay },
      dayLast: { gte: currentDay },
    },
  });
  const takenPlayerIds = new Set(takenTeams.map((t) => t.playerId));

  // Get user names for taken players
  const userIds = Array.from(new Set(takenTeams.map((t) => t.userId)));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map((u) => {
    const { cleanName } = parseUserName(u.name);
    return [u.id, cleanName];
  }));

  // Map player -> owner
  const playerOwnerMap = new Map<number, string>();
  takenTeams.forEach((t) => {
    playerOwnerMap.set(t.playerId, userMap.get(t.userId) ?? "?");
  });

  return clubs.map((c) => {
    const clubPlayers = playersByClub.get(c.id) || [];
    const taken = clubPlayers.filter((p) => takenPlayerIds.has(p.id));
    return {
      id: c.id,
      name: c.name,
      effectif: clubPlayers.length,
      taken: taken.length,
      free: clubPlayers.length - taken.length,
      players: clubPlayers.map((p) => ({
        id: p.id,
        name: `${p.fname} ${p.lname}`.trim(),
        position: mapPosition(p.position),
        owner: playerOwnerMap.get(p.id) ?? null,
      })),
    };
  }).filter((c) => c.effectif > 0);
}

// ── Cup context for a given matchday ─────────────────────
export interface CupMatchRow {
  id: number;
  round: string;
  position: number;
  matchday: number;
  user1Id: number | null;
  user2Id: number | null;
  score1: number | null;
  score2: number | null;
  winnerId: number | null;
}

export interface CupContext {
  cupId: number;
  cupName: string;
  round: string;
  matchday: number;
  matches: CupMatchRow[];
}

export async function getCupContextForDay(day: number): Promise<CupContext | null> {
  const cups = await prisma.$queryRawUnsafe<{ id: number; name: string }[]>(
    "SELECT id, name FROM CUP WHERE status = 'active' ORDER BY id DESC LIMIT 1"
  );
  if (cups.length === 0) return null;
  const cup = cups[0];

  const matches = await prisma.$queryRawUnsafe<{
    id: number; round: string; position: number; matchday: number;
    user1_id: number | null; user2_id: number | null;
    score1: number | null; score2: number | null; winner_id: number | null;
  }[]>(
    "SELECT id, round, position, matchday, user1_id, user2_id, score1, score2, winner_id FROM CUP_MATCH WHERE cup_id = ? AND matchday = ? ORDER BY position",
    cup.id, day
  );

  if (matches.length === 0) return null;

  return {
    cupId: Number(cup.id),
    cupName: cup.name,
    round: matches[0].round,
    matchday: day,
    matches: matches.map((m) => ({
      id: Number(m.id),
      round: m.round,
      position: Number(m.position),
      matchday: Number(m.matchday),
      user1Id: m.user1_id ? Number(m.user1_id) : null,
      user2Id: m.user2_id ? Number(m.user2_id) : null,
      score1: m.score1 !== null ? Number(m.score1) : null,
      score2: m.score2 !== null ? Number(m.score2) : null,
      winnerId: m.winner_id ? Number(m.winner_id) : null,
    })),
  };
}

export interface CupChampion {
  cupName: string;
  season: string;
  championName: string;
}

export async function getCupChampion(): Promise<CupChampion | null> {
  const cups = await prisma.$queryRawUnsafe<{ id: number; name: string; season: string }[]>(
    "SELECT id, name, season FROM CUP WHERE status IN ('active','finished') ORDER BY id DESC LIMIT 1"
  );
  if (cups.length === 0) return null;
  const cup = cups[0];

  const finals = await prisma.$queryRawUnsafe<{ winner_id: number | null }[]>(
    "SELECT winner_id FROM CUP_MATCH WHERE cup_id = ? AND round = 'Finale' AND winner_id IS NOT NULL LIMIT 1",
    cup.id
  );
  if (finals.length === 0 || !finals[0].winner_id) return null;

  const winnerId = Number(finals[0].winner_id);
  const users = await prisma.$queryRawUnsafe<{ NAME: string }[]>(
    "SELECT NAME FROM USER WHERE ID_USER = ? LIMIT 1",
    winnerId
  );
  const championName = (users[0]?.NAME ?? "").replace(/<[^>]*>/g, "").trim() || `#${winnerId}`;

  return {
    cupName: cup.name,
    season: cup.season,
    championName,
  };
}

// ── Player stats (cumulative across all matchdays) ────────
export async function getPlayerStats(limit = 10) {
  const scoringCfg = await getScoringConfig();
  const scores = await prisma.score.findMany({ where: { used: { gt: 0 } } });
  const playerMap = await getCachedPlayers();
  const clubMap = await getCachedClubNames();

  // Aggregate per player
  const agg = new Map<number, { totalPts: number; goals: number; passes: number; days: number }>();
  scores.forEach((s) => {
    const prev = agg.get(s.playerId) ?? { totalPts: 0, goals: 0, passes: 0, days: 0 };
    const player = playerMap.get(s.playerId);
    const pos = player?.position ?? "";
    const dayTotal = calcPlayerTotal(dec(s.points), s.goals, s.passes, pos, s.redCard, s.ownGoals, s.penaltySaved, scoringCfg);
    agg.set(s.playerId, {
      totalPts: prev.totalPts + dayTotal,
      goals: prev.goals + s.goals,
      passes: prev.passes + s.passes,
      days: prev.days + 1,
    });
  });

  function buildList(sortKey: "totalPts" | "goals" | "passes", ascending = false) {
    const sorted = Array.from(agg.entries())
      .filter(([, v]) => v.days >= 5) // minimum 5 appearances
      .sort((a, b) => ascending ? a[1][sortKey] - b[1][sortKey] : b[1][sortKey] - a[1][sortKey])
      .slice(0, limit);

    return sorted.map(([playerId, stats], i) => {
      const player = playerMap.get(playerId);
      return {
        rank: i + 1,
        playerId,
        name: player ? `${player.fname} ${player.lname}`.trim() : `Player ${playerId}`,
        club: player ? (clubMap.get(player.clubId) ?? "") : "",
        clubId: player?.clubId ?? 0,
        position: player ? mapPosition(player.position) : "MID" as Position,
        value: stats[sortKey],
        days: stats.days,
      };
    });
  }

  return {
    meilleursJoueurs: buildList("totalPts"),
    meilleursButeurs: buildList("goals"),
    meilleursPasseurs: buildList("passes"),
    piresJoueurs: buildList("totalPts", true),
  };
}

// ── Match player ratings (for L1 match cards) ───────────
export interface MatchPlayerRating {
  playerId: number;
  playerName: string;
  position: Position;
  rating: number | null;
  goals: number;
  passes: number;
  redCard: boolean;
  clubId: number;
}

export async function getMatchPlayerRatings(day: number): Promise<Map<number, MatchPlayerRating[]>> {
  const scores = await prisma.score.findMany({
    where: { day, used: { gt: 0 } },
  });

  const playerMap = await getCachedPlayers();

  const byClub = new Map<number, MatchPlayerRating[]>();

  scores.forEach((s) => {
    const player = playerMap.get(s.playerId);
    if (!player) return;
    const clubId = player.clubId;
    const arr = byClub.get(clubId) ?? [];
    arr.push({
      playerId: s.playerId,
      playerName: `${player.fname} ${player.lname}`.trim(),
      position: mapPosition(player.position),
      rating: s.points !== null ? dec(s.points) : null,
      goals: s.goals,
      passes: s.passes,
      redCard: s.redCard > 0,
      clubId,
    });
    byClub.set(clubId, arr);
  });

  // Sort each club's players by position order: GK, DEF, MID, ATT
  const posOrder: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
  byClub.forEach((players) => {
    players.sort((a, b) => posOrder[a.position] - posOrder[b.position]);
  });

  return byClub;
}

// ── League stats (vainqueurs par journée, meilleures journées) ──
export async function getLeagueStats(leagueDbId: number) {
  const allStats = await prisma.statsUser.findMany({
    where: { leagueId: leagueDbId },
    orderBy: { day: "asc" },
  });

  const participants = await getLeagueParticipants(leagueDbId);
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // Vainqueurs par journée (best PTS_TOT, tiebreak par moyenne pts/joueurs joues).
  // Aligne sur la regle de la coupe (admin/cup/route.ts:301-310). Si la moyenne
  // est aussi egale, on garde le premier rencontre (pas de tiebreak interligue ici).
  const dayMap = new Map<number, { userId: number; pts: number; avg: number }>();
  allStats.forEach((s) => {
    const prev = dayMap.get(s.day);
    const pts = dec(s.ptsTot);
    const avg = s.playerUsed > 0 ? pts / s.playerUsed : 0;
    if (
      !prev ||
      pts > prev.pts ||
      (pts === prev.pts && avg > prev.avg)
    ) {
      dayMap.set(s.day, { userId: s.userId, pts, avg });
    }
  });

  const vainqueursParJournee = Array.from(dayMap.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 10)
    .map(([day, { userId, pts }]) => ({
      journee: day,
      name: participantMap.get(userId)?.cleanName ?? `User ${userId}`,
      points: Math.round(pts * 10) / 10,
    }));

  // Meilleures journées ever (top single-day scores)
  const allDayScores = allStats.map((s) => ({
    userId: s.userId,
    day: s.day,
    pts: dec(s.ptsTot),
  }));
  const meilleuresJournees = allDayScores
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10)
    .map((s, i) => ({
      rank: i + 1,
      name: participantMap.get(s.userId)?.cleanName ?? `User ${s.userId}`,
      journee: s.day,
      points: Math.round(s.pts * 10) / 10,
    }));

  // Biggest progressions ever (rank change)
  const rankByDayUser = new Map<string, number>();
  // Build cumulative totals per day to compute real ranks
  const cumulByUser = new Map<number, number>();
  const days = Array.from(new Set(allStats.map((s) => s.day))).sort((a, b) => a - b);

  days.forEach((day) => {
    const dayEntries = allStats.filter((s) => s.day === day);
    dayEntries.forEach((s) => {
      cumulByUser.set(s.userId, (cumulByUser.get(s.userId) ?? 0) + dec(s.ptsTot));
    });
    // Rank by cumul
    const sorted = Array.from(cumulByUser.entries()).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([userId], idx) => {
      rankByDayUser.set(`${userId}-${day}`, idx + 1);
    });
  });

  const progressions: { name: string; journee: number; delta: number }[] = [];
  days.forEach((day, idx) => {
    if (idx === 0) return;
    const prevDay = days[idx - 1];
    const dayEntries = allStats.filter((s) => s.day === day);
    dayEntries.forEach((s) => {
      const curRank = rankByDayUser.get(`${s.userId}-${day}`) ?? 0;
      const prevRank = rankByDayUser.get(`${s.userId}-${prevDay}`) ?? curRank;
      const delta = prevRank - curRank;
      if (delta > 0) {
        progressions.push({
          name: participantMap.get(s.userId)?.cleanName ?? `User ${s.userId}`,
          journee: day,
          delta,
        });
      }
    });
  });

  const topProgressions = progressions.sort((a, b) => b.delta - a.delta).slice(0, 10);

  return { vainqueursParJournee, meilleuresJournees, topProgressions };
}

// ── Jokers remaining per participant in a league ────────
export async function getLeagueJokersRemaining(leagueDbId: number): Promise<Map<number, number>> {
  // Get max jokers from config
  const configs = await prisma.$queryRawUnsafe<{ max_count: number; deadline: string | null }[]>(
    "SELECT max_count, deadline FROM JOKER_CONFIG WHERE season = ? AND is_active = 1",
    await getCurrentSeasonKey()
  );
  const maxJokers = configs.reduce((sum, c) => {
    if (c.deadline && new Date(c.deadline) < new Date()) return sum;
    return sum + Number(c.max_count);
  }, 0);

  // Count jokers used per user in this league
  const logs = await prisma.$queryRawUnsafe<{ user_id: number; cnt: bigint }[]>(
    "SELECT user_id, COUNT(*) as cnt FROM JOKER_LOG WHERE league_id = ? GROUP BY user_id",
    leagueDbId
  );

  const result = new Map<number, number>();
  for (const log of logs) {
    result.set(Number(log.user_id), maxJokers - Number(log.cnt));
  }

  // Participants with no jokers used get full allowance
  // (we return the map, caller fills in defaults)
  result.set(-1, maxJokers); // sentinel: default value
  return result;
}

// ── Payment status per user in a league ─────────────────
export async function getLeaguePayments(leagueDbId: number): Promise<Map<number, boolean>> {
  const rows = await prisma.$queryRawUnsafe<{ user_id: number; paid: number }[]>(
    `SELECT p.user_id, p.paid FROM PAYMENT p
     JOIN LEAGUE_USER lu ON lu.ID_USER = p.user_id AND lu.ID_LEAGUE = ?
     WHERE p.season = ?`,
    leagueDbId, await getCurrentSeasonKey()
  );
  return new Map(rows.map(r => [Number(r.user_id), r.paid === 1]));
}
