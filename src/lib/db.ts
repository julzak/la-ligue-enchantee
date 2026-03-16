import { prisma } from "./prisma";
import type { Decimal } from "@prisma/client/runtime/library";

// ── Helpers ───────────────────────────────────────────────
function dec(v: Decimal | number | null): number {
  if (v === null) return 0;
  return typeof v === "number" ? v : Number(v);
}

// Trophy types from the img tags in USER.NAME
type TrophyType = "star" | "star-gold" | "cup" | "skull";

interface ParsedUser {
  id: number;
  cleanName: string;
  trophies: TrophyType[];
  email: string;
}

function parseUserName(raw: string): { cleanName: string; trophies: TrophyType[] } {
  const trophies: TrophyType[] = [];
  const imgRegex = /<img[^>]*src="[^"]*?(\w+)\.gif"[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(raw)) !== null) {
    const filename = match[1].toLowerCase();
    if (filename === "etoile_jaune" || filename === "etoile_or") trophies.push("star-gold");
    else if (filename === "etoile_rouge" || filename === "etoile") trophies.push("cup");
    else if (filename === "etoile_noire") trophies.push("star");
    else if (filename === "coupe" || filename === "trophee") trophies.push("cup");
    else if (filename === "skull" || filename === "tete_mort") trophies.push("skull");
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
  const leagues = await prisma.league.findMany({
    where: { id: { gt: 0 } }, // exclude legacy league 0
    orderBy: { id: "asc" },
  });
  return leagues.map((l) => ({
    id: l.id,
    slug: l.name.toLowerCase().includes("baudens") ? "ligue-1"
      : l.name.toLowerCase().includes("national") ? "national-1"
      : "ligue-2",
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
  const latest = await prisma.score.findFirst({ orderBy: { day: "desc" } });
  return latest?.day ?? 1;
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
    .slice(0, 20);

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
export async function getDayStats(day?: number) {
  const currentDay = day ?? await getCurrentMatchday();

  const scores = await prisma.score.findMany({ where: { day: currentDay } });
  const totalGoals = scores.reduce((sum, s) => sum + s.goals, 0);
  const totalPoints = scores.reduce((sum, s) => sum + dec(s.points) + 2 * s.goals + s.passes, 0);
  const playerCount = scores.filter((s) => s.used > 0).length;

  return {
    totalGoals,
    totalPoints: Math.round(totalPoints * 10) / 10,
    avgPerPlayer: playerCount > 0 ? Math.round(totalPoints / playerCount * 100) / 100 : 0,
    currentDay,
  };
}

// ── Best performances of the day ──────────────────────────
export async function getBestPerformances(day?: number, limit = 5) {
  const currentDay = day ?? await getCurrentMatchday();

  const scores = await prisma.score.findMany({
    where: { day: currentDay, used: { gt: 0 } },
    orderBy: [{ goals: "desc" }, { passes: "desc" }, { points: "desc" }],
    take: 50,
  });

  // Need player info
  const playerIds = scores.map((s) => s.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));

  // Sort by total points (POINTS + 2*GOALS + PASSES)
  const ranked = scores
    .map((s) => {
      const player = playerMap.get(s.playerId);
      const total = dec(s.points) + 2 * s.goals + s.passes;
      const details: string[] = [];
      if (s.goals > 0) details.push(`${s.goals} but${s.goals > 1 ? "s" : ""}`);
      if (s.passes > 0) details.push(`${s.passes} passe${s.passes > 1 ? "s" : ""}`);
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

  const scores = await prisma.score.findMany({
    where: { day: currentDay, used: { gt: 0 } },
    take: 500,
  });

  const playerIds = scores.map((s) => s.playerId);
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));

  const ranked = scores
    .map((s) => {
      const player = playerMap.get(s.playerId);
      const total = dec(s.points) + 2 * s.goals + s.passes;
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

  // Get lineup for this day
  const lineup = await prisma.teamDay.findMany({
    where: {
      leagueId: leagueDbId,
      userId,
      day: currentDay,
    },
    orderBy: { indx: "asc" },
  });

  const lineupPlayerIds = new Set(lineup.map((l) => l.playerId));

  // Get player details
  const playerIds = teamMembers.map((t) => t.playerId);
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  return teamMembers.map((t) => {
    const player = playerMap.get(t.playerId);
    const club = player ? clubMap.get(player.clubId) : null;
    const isStarter = lineupPlayerIds.has(t.playerId);
    const lineupEntry = lineup.find((l) => l.playerId === t.playerId);

    return {
      playerId: t.playerId,
      playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${t.playerId}`,
      position: player ? mapPosition(player.position) : "MID" as Position,
      clubName: club?.name ?? "",
      clubId: player?.clubId ?? 0,
      isStarter,
      indx: lineupEntry?.indx ?? 99,
      isSubs: t.isSubs === 1,
      dayFirst: t.dayFirst,
      dayLast: t.dayLast,
    };
  }).sort((a, b) => a.indx - b.indx);
}

// ── Player scores for a participant on a specific day ─────
export async function getParticipantDayScores(leagueDbId: number, userId: number, day: number) {
  const lineup = await prisma.teamDay.findMany({
    where: { leagueId: leagueDbId, userId, day },
    orderBy: { indx: "asc" },
  });

  const playerIds = lineup.map((l) => l.playerId);
  const scores = await prisma.score.findMany({
    where: { day, playerId: { in: playerIds } },
  });
  const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));

  return lineup.map((l) => {
    const player = playerMap.get(l.playerId);
    const score = scoreMap.get(l.playerId);
    const total = score ? dec(score.points) + 2 * score.goals + score.passes : 2; // forfait

    return {
      playerId: l.playerId,
      playerName: player ? `${player.fname} ${player.lname}`.trim() : `Player ${l.playerId}`,
      position: player ? mapPosition(player.position) : "MID" as Position,
      clubName: player ? (clubMap.get(player.clubId) ?? "") : "",
      indx: l.indx,
      rating: score ? dec(score.points) : null,
      goals: score?.goals ?? 0,
      passes: score?.passes ?? 0,
      total: Math.round(total * 10) / 10,
    };
  });
}

// ── Clubs with player counts ──────────────────────────────
export async function getClubsWithStats(leagueDbId: number, day?: number) {
  const currentDay = day ?? await getCurrentMatchday();
  const clubs = await prisma.club.findMany({ orderBy: { name: "asc" } });

  // Get all players per club
  const players = await prisma.player.findMany();
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

// ── Player stats (cumulative across all matchdays) ────────
export async function getPlayerStats(limit = 10) {
  const scores = await prisma.score.findMany({ where: { used: { gt: 0 } } });
  const players = await prisma.player.findMany();
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const clubs = await prisma.club.findMany();
  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));

  // Aggregate per player
  const agg = new Map<number, { totalPts: number; goals: number; passes: number; days: number }>();
  scores.forEach((s) => {
    const prev = agg.get(s.playerId) ?? { totalPts: 0, goals: 0, passes: 0, days: 0 };
    agg.set(s.playerId, {
      totalPts: prev.totalPts + dec(s.points) + 2 * s.goals + s.passes,
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
        name: player ? `${player.fname} ${player.lname}`.trim() : `Player ${playerId}`,
        club: player ? (clubMap.get(player.clubId) ?? "") : "",
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

// ── League stats (vainqueurs par journée, meilleures journées) ──
export async function getLeagueStats(leagueDbId: number) {
  const allStats = await prisma.statsUser.findMany({
    where: { leagueId: leagueDbId },
    orderBy: { day: "asc" },
  });

  const participants = await getLeagueParticipants(leagueDbId);
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // Vainqueurs par journée (best PTS_TOT per day)
  const dayMap = new Map<number, { userId: number; pts: number }>();
  allStats.forEach((s) => {
    const prev = dayMap.get(s.day);
    const pts = dec(s.ptsTot);
    if (!prev || pts > prev.pts) {
      dayMap.set(s.day, { userId: s.userId, pts });
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
