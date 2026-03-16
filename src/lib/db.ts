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

  // Get cumulative stats for this day
  const stats = await prisma.statsUser.findMany({
    where: { leagueId: leagueDbId, day: currentDay },
    orderBy: { ptsTot: "desc" },
  });

  // Get previous day stats for delta
  const prevStats = currentDay > 1
    ? await prisma.statsUser.findMany({
        where: { leagueId: leagueDbId, day: currentDay - 1 },
      })
    : [];
  const prevRankMap = new Map(prevStats.map((s) => [s.userId, s.rankLeague]));

  // To get matchday-only points, we need current - previous cumulative
  const prevTotMap = new Map<number, number>();
  if (currentDay > 1) {
    const prevCum = await prisma.statsUser.findMany({
      where: { leagueId: leagueDbId, day: currentDay - 1 },
    });
    prevCum.forEach((s) => prevTotMap.set(s.userId, dec(s.ptsTot)));
  }

  const standings: StandingRow[] = stats.map((s, i) => {
    const user = participantMap.get(s.userId);
    const prevRank = prevRankMap.get(s.userId) ?? (i + 1);
    const prevTotal = prevTotMap.get(s.userId) ?? 0;
    const matchdayPts = dec(s.ptsTot) - prevTotal;

    return {
      userId: s.userId,
      userName: user?.cleanName ?? `User ${s.userId}`,
      trophies: user?.trophies ?? [],
      initials: user ? getInitials(user.cleanName) : "??",
      rank: s.rankLeague,
      totalPoints: dec(s.ptsTot),
      lastMatchdayPoints: Math.round(matchdayPts * 10) / 10,
      ptsPerDay: s.playerUsed > 0 ? Math.round(dec(s.ptsTot) / currentDay * 100) / 100 : 0,
      delta: prevRank - s.rankLeague,
      ptsGk: dec(s.ptsGk),
      ptsDf: dec(s.ptsDf),
      ptsMf: dec(s.ptsMf),
      ptsSt: dec(s.ptsSt),
      ptsPas: s.ptsPas,
      ptsGls: s.ptsGls,
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

  const allStats = await prisma.statsUser.findMany({
    where: { day: currentDay, leagueId: { gt: 0 } },
    orderBy: { ptsTot: "desc" },
    take: 20,
  });

  const userIds = allStats.map((s) => s.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map((u) => {
    const { cleanName, trophies } = parseUserName(u.name);
    return [u.id, { cleanName, trophies }];
  }));

  const leagueMap = new Map(leagues.map((l) => [l.dbId, l.name]));

  return allStats.map((s, i) => {
    const user = userMap.get(s.userId);
    return {
      rank: i + 1,
      userId: s.userId,
      userName: user?.cleanName ?? `User ${s.userId}`,
      trophies: user?.trophies ?? [],
      leagueName: leagueMap.get(s.leagueId) ?? "?",
      leagueSlug: leagues.find((l) => l.dbId === s.leagueId)?.slug ?? "ligue-1",
      totalPoints: dec(s.ptsTot),
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
