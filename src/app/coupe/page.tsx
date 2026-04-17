export const revalidate = 300; // ISR: refresh every 5 min

import { prisma } from "@/lib/prisma";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default async function CoupePage() {
  // Get latest active cup
  const cups = await prisma.$queryRawUnsafe<{
    id: number; name: string; season: string; status: string;
  }[]>("SELECT id, name, season, status FROM CUP ORDER BY id DESC LIMIT 1");

  if (cups.length === 0) {
    return (
      <>
        <Navbar />
        <div className="pt-[52px] max-w-5xl mx-auto px-4 py-12 text-center">
          <Trophy className="w-16 h-16 text-muted mx-auto mb-4" />
          <p className="text-muted text-lg">Aucune coupe en cours</p>
        </div>
      </>
    );
  }

  const cup = cups[0];

  const matches = await prisma.$queryRawUnsafe<{
    id: number; round: string; position: number; matchday: number | null;
    user1_id: number | null; user2_id: number | null;
    score1: number | null; score2: number | null;
    winner_id: number | null;
  }[]>("SELECT * FROM CUP_MATCH WHERE cup_id = ? ORDER BY position", cup.id);

  // Get user names
  const userIds = Array.from(new Set(
    matches.flatMap((m) => [m.user1_id, m.user2_id].filter(Boolean))
  )) as number[];

  const users = userIds.length > 0
    ? await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
        `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${userIds.join(",")})`)
    : [];
  const userMap = new Map(users.map((u) => [
    Number(u.ID_USER),
    (u.NAME ?? "").replace(/<[^>]*>/g, "").trim(),
  ]));

  // Get league info per user
  const leagueUsers = userIds.length > 0
    ? await prisma.$queryRawUnsafe<{ ID_USER: number; ID_LEAGUE: number }[]>(
        `SELECT ID_USER, ID_LEAGUE FROM LEAGUE_USER WHERE ID_USER IN (${userIds.join(",")})`)
    : [];
  const leagueMap = new Map(leagueUsers.map((lu) => [Number(lu.ID_USER), Number(lu.ID_LEAGUE)]));
  const leagueLabels: Record<number, string> = { 19: "L2", 20: "L1", 22: "Nat." };

  // Get intra-league cumulative ranks for petit poucet bonus
  // Each user has a rank within their own league (1-18), not across all leagues
  const leagueStats = await prisma.$queryRawUnsafe<{ userId: number; leagueId: number; total: number }[]>(
    `SELECT s.ID_USER as userId, s.ID_LEAGUE as leagueId, SUM(s.PTS_TOT) as total
     FROM STATS_USER s WHERE s.ID_LEAGUE > 0
     GROUP BY s.ID_USER, s.ID_LEAGUE
     ORDER BY s.ID_LEAGUE, total DESC`
  );
  // Build rankMap: userId -> rank within their own league
  const rankMap = new Map<number, number>();
  const byLeague = new Map<number, { userId: number; total: number }[]>();
  leagueStats.forEach((s) => {
    const lid = Number(s.leagueId);
    if (!byLeague.has(lid)) byLeague.set(lid, []);
    byLeague.get(lid)!.push({ userId: Number(s.userId), total: Number(s.total) });
  });
  byLeague.forEach((users) => {
    users.sort((a, b) => b.total - a.total);
    users.forEach((u, i) => rankMap.set(u.userId, i + 1));
  });

  // Check if petit poucet is enabled
  const [cupMeta] = await prisma.$queryRawUnsafe<{ petit_poucet: number }[]>(
    "SELECT petit_poucet FROM CUP WHERE id = ?", cup.id
  );
  const petitPoucet = cupMeta?.petit_poucet === 1;

  const rounds = Array.from(new Set(matches.map((m) => m.round)));

  // Build feeder map: for each match position, find which 2 matches from the
  // previous round feed into it (winners become user1 and user2).
  // Structure: consecutive pairs (pos P, P+1) feed into the next round's match.
  const matchByPos = new Map(matches.map((m) => [Number(m.position), m]));
  const roundBounds = rounds.map((r) => {
    const rm = matches.filter((m) => m.round === r);
    return { round: r, start: Math.min(...rm.map((m) => Number(m.position))), count: rm.length };
  });

  // feederLabel: for a NULL slot in a match, describe who could fill it
  function feederLabel(position: number, slot: "user1" | "user2"): string {
    // Find the round this match belongs to
    const roundIdx = roundBounds.findIndex((rb) => position >= rb.start && position < rb.start + rb.count);
    if (roundIdx <= 0) return "?";
    const prevRound = roundBounds[roundIdx - 1];
    const currentRound = roundBounds[roundIdx];
    const offset = position - currentRound.start;
    const feederPos = prevRound.start + offset * 2 + (slot === "user1" ? 0 : 1);
    const feeder = matchByPos.get(feederPos);
    if (!feeder) return "?";
    if (feeder.winner_id) return userMap.get(Number(feeder.winner_id)) ?? "?";
    const n1 = feeder.user1_id ? (userMap.get(Number(feeder.user1_id)) ?? "?") : "?";
    const n2 = feeder.user2_id ? (userMap.get(Number(feeder.user2_id)) ?? "?") : "?";
    return `Vq ${n1.split(" ")[0]}/${n2.split(" ")[0]}`;
  }

  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl text-rouge mb-2 flex items-center justify-center gap-3">
              🔥 {cup.name}
            </h1>
            <p className="text-sm text-muted">Saison {cup.season} - Compétition interligue</p>
            <p className="text-xs text-white/30 italic mt-3 max-w-lg mx-auto">
              &laquo; Je ne joue pas contre une équipe en particulier. Je joue pour me battre contre l&apos;idée de perdre. &raquo;
              <span className="text-white/20 not-italic"> - Eric Cantona</span>
            </p>
          </div>

          {/* Bracket */}
          <div className="space-y-8">
            {rounds.map((round) => {
              const roundMatches = matches.filter((m) => m.round === round);
              const firstMatch = roundMatches[0];
              const allResolved = roundMatches.every((m) => m.winner_id !== null);

              return (
                <div key={round}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-serif text-lg text-white">{round}</h2>
                    {firstMatch?.matchday && (
                      <span className="text-xs bg-rouge/10 text-rouge px-2 py-0.5 rounded">J{Number(firstMatch.matchday)}</span>
                    )}
                    {allResolved && <span className="text-xs text-vert">Terminé</span>}
                    {!allResolved && firstMatch?.matchday && <span className="text-xs text-gold">À venir</span>}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {roundMatches.map((m) => {
                      const u1Name = m.user1_id ? userMap.get(Number(m.user1_id)) ?? "?" : feederLabel(Number(m.position), "user1");
                      const u2Name = m.user2_id ? userMap.get(Number(m.user2_id)) ?? "?" : feederLabel(Number(m.position), "user2");
                      const u1Tbd = !m.user1_id;
                      const u2Tbd = !m.user2_id;
                      const u1League = m.user1_id ? leagueLabels[leagueMap.get(Number(m.user1_id)) ?? 0] ?? "" : "";
                      const u2League = m.user2_id ? leagueLabels[leagueMap.get(Number(m.user2_id)) ?? 0] ?? "" : "";
                      const isResolved = m.winner_id !== null;
                      const u1Won = Number(m.winner_id) === Number(m.user1_id);
                      const u2Won = Number(m.winner_id) === Number(m.user2_id);

                      // Petit poucet bonus: difference of intra-league ranks / 2,
                      // attributed to the lesser-ranked player (higher rank number).
                      // No bonus if either user has no rank (not in stats yet).
                      let u1Bonus = 0;
                      let u2Bonus = 0;
                      if (petitPoucet && m.user1_id && m.user2_id) {
                        const rank1 = rankMap.get(Number(m.user1_id));
                        const rank2 = rankMap.get(Number(m.user2_id));
                        if (rank1 !== undefined && rank2 !== undefined) {
                          const diff = Math.abs(rank1 - rank2);
                          const bonus = Math.floor(diff / 2);
                          if (rank1 > rank2) u1Bonus = bonus;
                          else if (rank2 > rank1) u2Bonus = bonus;
                        }
                      }

                      return (
                        <div
                          key={m.id}
                          className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden"
                        >
                          {/* Player 1 */}
                          <div className={`flex items-center gap-2 px-3 py-2 ${u1Won ? "bg-rouge/10" : isResolved ? "opacity-40" : ""}`}>
                            <span className={`text-xs flex-1 truncate ${u1Tbd ? "text-white/30 italic" : u1Won ? "text-white font-medium" : "text-white/70"}`}>
                              {u1Name}
                              {!u1Tbd && u1League && <span className="text-[9px] text-muted ml-1">({u1League})</span>}
                              {!u1Tbd && u1Bonus > 0 && <span className="text-[9px] text-vert ml-1">+{u1Bonus}</span>}
                            </span>
                            {m.score1 !== null && (
                              <span className={`text-xs tabular-nums font-bold ${u1Won ? "text-rouge" : "text-muted"}`}>
                                {Number(m.score1).toFixed(0)}
                              </span>
                            )}
                          </div>

                          {/* Separator */}
                          <div className="border-t border-white/[0.05]" />

                          {/* Player 2 */}
                          <div className={`flex items-center gap-2 px-3 py-2 ${u2Won ? "bg-rouge/10" : isResolved ? "opacity-40" : ""}`}>
                            <span className={`text-xs flex-1 truncate ${u2Tbd ? "text-white/30 italic" : u2Won ? "text-white font-medium" : "text-white/70"}`}>
                              {u2Name}
                              {!u2Tbd && u2League && <span className="text-[9px] text-muted ml-1">({u2League})</span>}
                              {!u2Tbd && u2Bonus > 0 && <span className="text-[9px] text-vert ml-1">+{u2Bonus}</span>}
                            </span>
                            {m.score2 !== null && (
                              <span className={`text-xs tabular-nums font-bold ${u2Won ? "text-rouge" : "text-muted"}`}>
                                {Number(m.score2).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <Link href="/" className="text-sm text-gold hover:underline">← Retour à l&apos;accueil</Link>
          </div>
        </div>
      </div>
    </>
  );
}
