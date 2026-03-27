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

  const rounds = Array.from(new Set(matches.map((m) => m.round)));

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
                      const u1Name = m.user1_id ? userMap.get(Number(m.user1_id)) ?? "?" : "";
                      const u2Name = m.user2_id ? userMap.get(Number(m.user2_id)) ?? "?" : "";
                      const u1League = m.user1_id ? leagueLabels[leagueMap.get(Number(m.user1_id)) ?? 0] ?? "" : "";
                      const u2League = m.user2_id ? leagueLabels[leagueMap.get(Number(m.user2_id)) ?? 0] ?? "" : "";
                      const isResolved = m.winner_id !== null;
                      const u1Won = Number(m.winner_id) === Number(m.user1_id);
                      const u2Won = Number(m.winner_id) === Number(m.user2_id);

                      return (
                        <div
                          key={m.id}
                          className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden"
                        >
                          {/* Player 1 */}
                          <div className={`flex items-center gap-2 px-3 py-2 ${u1Won ? "bg-rouge/10" : isResolved ? "opacity-40" : ""}`}>
                            <span className={`text-xs flex-1 truncate ${u1Won ? "text-white font-medium" : "text-white/70"}`}>
                              {u1Name}
                              {u1League && <span className="text-[9px] text-muted ml-1">({u1League})</span>}
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
                            <span className={`text-xs flex-1 truncate ${u2Won ? "text-white font-medium" : "text-white/70"}`}>
                              {u2Name}
                              {u2League && <span className="text-[9px] text-muted ml-1">({u2League})</span>}
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
