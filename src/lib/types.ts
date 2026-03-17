// ── Positions ──────────────────────────────────────────────
export type Position = "GK" | "DEF" | "MID" | "ATT";

// ── Trophies ──────────────────────────────────────────────
export type TrophyType = "star" | "star-gold" | "cup" | "skull";

// ── Club ──────────────────────────────────────────────────
export interface Club {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
}

// ── Player ────────────────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  position: Position;
  clubId: string;
  imageUrl?: string; // headshot URL, fallback to silhouette
}

// ── Form indicator ────────────────────────────────────────
export type FormIndicator = "hot" | "cold" | null;

// ── Matchday ──────────────────────────────────────────────
export type MatchdayStatus = "PUBLISHED" | "LOCKED" | "UPCOMING";

export interface Matchday {
  number: number;
  status: MatchdayStatus;
  lockAt: string;
  publishedAt: string | null;
}

// ── Performance ───────────────────────────────────────────
export interface Performance {
  playerId: string;
  matchday: number;
  minutesPlayed: number | null;
  rating: number | null;
  goals: number;
  assists: number;
  ownGoals: number;
  redCard: boolean;
  penaltySaved: number;
  penaltyMissed: number;
  tapisVert?: {
    withTeamSheet: boolean;
    isWinningSide: boolean;
    isStarter: boolean;
  };
}

// ── Squad ─────────────────────────────────────────────────
export interface SquadPlayer {
  playerId: string;
  isStarter: boolean;
}

export interface Squad {
  participantId: string;
  players: SquadPlayer[];
  budgetSpent: number;
  budgetTotal: number;
}

// ── Lineup ────────────────────────────────────────────────
export interface Lineup {
  participantId: string;
  matchday: number;
  starterIds: string[];
}

// ── Standing (per league) ─────────────────────────────────
export interface Standing {
  rank: number;
  participantId: string;
  participantName: string;
  totalPoints: number;
  lastMatchdayPoints: number;
  ptsPerDay: number;
  delta: number;
}

// ── Interleague standing ──────────────────────────────────
export interface InterleagueStanding {
  rank: number;
  participantId: string;
  participantName: string;
  leagueName: string;
  totalPoints: number;
}

// ── League ────────────────────────────────────────────────
export interface League {
  id: string;
  slug: string;
  name: string;
  participantCount: number;
  participants: Participant[];
}

export interface LeagueStandings {
  totalPoints: number;
  pointsJournee: number;
  ratio: number;
  standings: Standing[];
}

// ── Best performance of the day ───────────────────────────
export interface BestPerformance {
  playerName: string;
  club: string;
  points: number;
  detail: string;
}

// ── Day stats ─────────────────────────────────────────────
export interface DayStats {
  totalGoals: number;
  totalPoints: number;
  avgPerPlayer: number;
}

// ── Cup ───────────────────────────────────────────────────
export interface CupMatch {
  round: string;
  participant1Id: string;
  participant2Id: string;
  score1: number | null;
  score2: number | null;
  matchday: number;
}

// ── L1 Match result ──────────────────────────────────────
export interface L1Match {
  matchday: number;
  homeClubId: number;
  awayClubId: number;
  homeScore: number;
  awayScore: number;
  date: string;
}

// ── Forum ─────────────────────────────────────────────────
export interface ForumTopic {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  lastReplyAt: string;
  replyCount: number;
  pinned: boolean;
}

export interface ForumComment {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ── Participant ───────────────────────────────────────────
export interface Participant {
  id: string;
  name: string;
  avatarInitials: string;
  trophies: TrophyType[];
}

// ── Scoring results ───────────────────────────────────────
export interface PlayerPointsBreakdown {
  base: number;
  goalBonus: number;
  assistBonus: number;
  penaltySavedBonus: number;
  ownGoalMalus: number;
  redCardApplied: boolean;
  total: number;
}

export interface MatchdayScore {
  participantId: string;
  matchday: number;
  total: number;
  playerScores: {
    playerId: string;
    breakdown: PlayerPointsBreakdown;
  }[];
}
