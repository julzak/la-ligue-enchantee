export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getLeagues,
  getInterleagueStandings,
  getDayStats,
  getBestPerformances,
  getWorstPerformances,
  getCurrentMatchday,
  getLeagueStandings,
  getMatchPlayerRatings,
} from "@/lib/db";
import { getClubLogoUrl, getClubShortName, getClubIdByTeamName } from "@/lib/assets";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { MatchCard } from "@/components/scoring/MatchCard";
import { ChevronRight, Flame, ThumbsDown, Skull } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const [leagues, interleagueStandings, dayStats, bestPerformances, worstPerformances, currentMatchday] =
    await Promise.all([
      getLeagues(),
      getInterleagueStandings(),
      getDayStats(),
      getBestPerformances(),
      getWorstPerformances(),
      getCurrentMatchday(),
    ]);

  // L1 match results from MATCH_SCHEDULE table + player ratings
  const matchRatings = await getMatchPlayerRatings(currentMatchday);
  const dbMatches = await prisma.$queryRawUnsafe<{
    home_team: string; away_team: string; home_score: number | null; away_score: number | null;
  }[]>(
    "SELECT home_team, away_team, home_score, away_score FROM MATCH_SCHEDULE WHERE matchday = ? AND home_score IS NOT NULL ORDER BY match_date",
    currentMatchday
  );

  // Fetch league standings for each league in parallel
  const leagueStandingsMap = new Map<string, Awaited<ReturnType<typeof getLeagueStandings>>>();
  const leagueStandingsResults = await Promise.all(
    leagues.map((league) => getLeagueStandings(league.dbId))
  );
  leagues.forEach((league, i) => {
    leagueStandingsMap.set(league.slug, leagueStandingsResults[i]);
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-[52px]" />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Matchday header */}
          <div className="bg-surface rounded-lg border border-white/[0.07] p-8 text-center">
            <div className="flex justify-center mb-4">
              <svg width="90" height="103" viewBox="0 0 130 148" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="sp-hp" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                    <rect width="5" height="10" fill="#C8A84B"/>
                  </pattern>
                </defs>
                <path d="M10,8 L120,8 L120,108 Q65,145 10,108 Z" fill="#1C1C1C"/>
                <path d="M10,8 L120,8 L120,108 Q65,145 10,108 Z" fill="url(#sp-hp)" opacity="0.055"/>
                <path d="M10,8 L120,8 L120,108 Q65,145 10,108 Z" fill="none" stroke="#C8A84B" strokeWidth="2"/>
                <path d="M17,15 L113,15 L113,105 Q65,137 17,105 Z" fill="none" stroke="#C8A84B" strokeWidth="0.5" opacity="0.3"/>
                <line x1="10" y1="66" x2="120" y2="66" stroke="#C8A84B" strokeWidth="0.7" opacity="0.35"/>
                <polygon points="35,26 36.8,32 43,32 38,35.5 40,41.5 35,38 30,41.5 32,35.5 27,32 33.2,32" fill="#C8A84B"/>
                <polygon points="65,20 67.2,27 74,27 68.5,31 70.8,38 65,34 59.2,38 61.5,31 56,27 62.8,27" fill="#C8A84B"/>
                <polygon points="95,26 96.8,32 103,32 98,35.5 100,41.5 95,38 90,41.5 92,35.5 87,32 93.2,32" fill="#C8A84B"/>
                <text x="65" y="56" fontFamily="Arial Black,Impact,sans-serif" fontSize="12" fontWeight="900" fill="rgba(255,255,255,.3)" textAnchor="middle" dominantBaseline="central" letterSpacing="5">LA</text>
                <text x="65" y="78" fontFamily="Arial Black,Impact,sans-serif" fontSize="23" fontWeight="900" fill="#FFFFFF" textAnchor="middle" dominantBaseline="central" letterSpacing="-0.5">LIGUE</text>
                <text x="65" y="100" fontFamily="Georgia,serif" fontSize="11" fontWeight="400" fontStyle="italic" fill="#C8A84B" textAnchor="middle" dominantBaseline="central" letterSpacing="2.5">Enchantée</text>
              </svg>
            </div>
            <h1 className="font-serif text-3xl text-gold mb-2">Journée {currentMatchday}</h1>
            <p className="text-xs text-white/30 italic tracking-wide">La fantasy league est une affaire sérieuse</p>
            {/* Quick links — visual cards with logos */}
            <div className="flex justify-center gap-3 mt-5 flex-wrap">
              {[
                { href: "/ligue/ligue-1/classement", label: "Ligue 1", img: "/leagues/ligue1.svg", bg: "bg-[#0052B4]", invert: false },
                { href: "/ligue/ligue-2/classement", label: "Ligue 2", img: "/leagues/ligue2.png", bg: "bg-white", invert: false },
                { href: "/ligue/national-1/classement", label: "National", img: "/leagues/national.png", bg: "bg-[#2BA3D4]", invert: false },
                { href: "/coupe", label: "Coupe", img: "/leagues/coupe.png", bg: "bg-[#1B2A5B]", invert: true },
                { href: "/forum", label: "Forum", img: null, bg: "bg-gold/20", invert: false },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col items-center gap-1.5 w-16 sm:w-20 transition-transform hover:scale-105"
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${item.bg} border border-white/[0.1] flex items-center justify-center overflow-hidden shadow-md group-hover:shadow-gold/10 transition-shadow`}>
                    {item.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.img} alt={item.label} className={`w-8 h-8 sm:w-10 sm:h-10 object-contain ${item.invert ? "invert brightness-0 contrast-200 brightness-200" : ""}`} style={item.invert ? { filter: "invert(1)" } : undefined} />
                    ) : (
                      <span className="text-gold text-lg">💬</span>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted group-hover:text-gold transition-colors text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Day results */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
              <span className="text-3xl font-serif font-bold text-gold">{dayStats.totalGoals}</span>
              <p className="text-xs text-muted mt-1">Buts marqués</p>
              <p className="text-[10px] text-white/20 italic mt-0.5">moy. saison : {dayStats.seasonAvgGoals}/j</p>
            </div>
            <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
              <span className="text-3xl font-serif font-bold text-white">{dayStats.totalPoints.toFixed(0)}</span>
              <p className="text-xs text-muted mt-1">Points cumulés</p>
              <p className="text-[10px] text-white/20 italic mt-0.5">moy. saison : {dayStats.seasonAvgPoints}/j</p>
            </div>
            <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
              <span className="text-3xl font-serif font-bold text-white/70">{dayStats.avgPerPlayer.toFixed(2)}</span>
              <p className="text-xs text-muted mt-1">Pts par joueur</p>
              <p className="text-[10px] text-white/20 italic mt-0.5">moy. saison : {dayStats.seasonAvgPerPlayer}</p>
            </div>
          </div>

          {/* Best & Worst performances side by side */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Best */}
            <div className="bg-surface rounded-lg border border-vert/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-5 h-5 text-orange-400" />
                <h2 className="font-serif text-base text-white">Meilleures performances</h2>
              </div>
              <div className="space-y-2.5">
                {bestPerformances.map((bp, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-5 text-center font-bold ${i === 0 ? "text-gold" : "text-muted"}`}>{i + 1}.</span>
                    <span className="text-white font-medium flex-1 truncate">{bp.playerName}</span>
                    <span className="text-[10px] text-muted uppercase">{bp.club}</span>
                    <span className="text-gold font-bold tabular-nums">{bp.points.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Worst - Onze des Saucisses */}
            <div className="bg-surface rounded-lg border border-rouge/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ThumbsDown className="w-5 h-5 text-rouge" />
                <h2 className="font-serif text-base text-white">Le Onze des Saucisses</h2>
              </div>
              <div className="space-y-2.5">
                {worstPerformances.map((wp, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-center font-bold text-muted">{i + 1}.</span>
                    <span className="text-white/70 flex-1 truncate">{wp.playerName}</span>
                    <span className="text-[10px] text-muted uppercase">{wp.club}</span>
                    <span className="text-rouge font-bold tabular-nums">{wp.points.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* L1 Match results — collapsible */}
          {dbMatches.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer list-none py-2 hover:opacity-80 transition-opacity">
                <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <h2 className="font-serif text-base text-white">Résultats de la journée</h2>
                <span className="text-[10px] text-white/20 ml-auto">{dbMatches.length} matchs</span>
              </summary>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                {dbMatches.map((m) => {
                  const homeId = getClubIdByTeamName(m.home_team);
                  const awayId = getClubIdByTeamName(m.away_team);
                  return (
                    <MatchCard
                      key={`${m.home_team}-${m.away_team}`}
                      homeClub={homeId ? getClubShortName(homeId) : m.home_team}
                      awayClub={awayId ? getClubShortName(awayId) : m.away_team}
                      homeLogo={homeId ? getClubLogoUrl(homeId) : null}
                      awayLogo={awayId ? getClubLogoUrl(awayId) : null}
                      homeScore={m.home_score ?? 0}
                      awayScore={m.away_score ?? 0}
                      homeRatings={homeId ? (matchRatings.get(homeId) ?? []) : []}
                      awayRatings={awayId ? (matchRatings.get(awayId) ?? []) : []}
                    />
                  );
                })}
              </div>
            </details>
          )}

          {/* League summaries — ordered: L1, L2, National */}
          <div>
            <h2 className="font-serif text-lg text-white mb-4">Les ligues</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...leagues].sort((a, b) => {
                const order: Record<string, number> = { "ligue-1": 0, "ligue-2": 1, "national-1": 2 };
                return (order[a.slug] ?? 9) - (order[b.slug] ?? 9);
              }).map((league) => {
                const stats = leagueStandingsMap.get(league.slug);
                if (!stats) return null;
                const leaderName = stats.standings[0]?.userName ?? "";
                return (
                  <Link
                    key={league.id}
                    href={`/ligue/${league.slug}/classement`}
                    className="bg-surface rounded-lg border border-white/[0.07] p-5 hover:border-gold/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-serif text-base text-white group-hover:text-gold transition-colors">
                        {league.name}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-gold transition-colors" />
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">Participants</span>
                        <span className="text-white">{stats.standings.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Leader</span>
                        <span className="text-gold font-medium">{leaderName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Points journée</span>
                        <span className="text-white">{stats.pointsJournee.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Total</span>
                        <span className="text-white font-medium">{stats.totalPoints.toLocaleString("fr-FR")}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar - Classement interligue */}
        <aside className="w-full lg:w-80 lg:shrink-0">
          <div className="sticky top-6 space-y-4">
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="bg-gold/10 px-4 py-3 border-b border-gold/20">
              <h2 className="font-serif text-sm text-gold font-medium">Classement interligue</h2>
            </div>
            <div className="divide-y divide-white/[0.05] zebra">
              <div className="grid grid-cols-[2rem_1fr_4.5rem_3.5rem] px-3 py-2 text-[10px] uppercase tracking-wider text-muted">
                <span></span>
                <span>Joueur</span>
                <span>Ligue</span>
                <span className="text-right">Points</span>
              </div>
              {interleagueStandings.slice(0, 20).map((s) => (
                <Link
                  key={s.userId}
                  href={`/ligue/${s.leagueSlug}/equipe/${s.userId}`}
                  className="grid grid-cols-[2rem_1fr_4.5rem_3.5rem] px-3 py-2 items-center text-xs hover:bg-white/[0.04] transition-colors"
                >
                  <span className={`font-bold ${s.rank <= 3 ? "text-gold" : "text-muted"}`}>
                    {s.rank}
                  </span>
                  <span className="text-white truncate flex items-center hover:text-gold transition-colors">
                    {s.userName}
                    <TrophyBadges trophies={s.trophies} leagueSlug={s.leagueSlug} />
                  </span>
                  <span className="text-[10px] text-muted truncate">{s.leagueName.replace("Ligue 1 (Baudens League)", "L1").replace("National 1", "Nat. 1").replace("Ligue 2", "L2")}</span>
                  <span className="text-right text-white font-medium tabular-nums">
                    {s.totalPoints.toFixed(1)}
                  </span>
                </Link>
              ))}
            </div>
            {interleagueStandings.length > 20 && (
              <Link href="/classement-interligue" className="block text-center py-2 text-xs text-gold hover:underline border-t border-white/[0.05]">
                Voir tout le classement ({interleagueStandings.length} participants)
              </Link>
            )}
          </div>

          {/* Coupe encart */}
          <Link href="/coupe" className="block bg-surface rounded-lg border border-rouge/30 overflow-hidden mt-4 hover:border-rouge/50 transition-colors group">
            <div className="bg-rouge/10 px-4 py-3 border-b border-rouge/20">
              <h2 className="font-serif text-sm text-rouge font-medium flex items-center gap-2">
                🔥 La Coupe
              </h2>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-white/70">Huitièmes de finale</p>
              <p className="text-xs text-muted mt-1">16 matchs joués - Quarts à venir</p>
              <p className="text-xs text-rouge/70 mt-2 group-hover:text-rouge transition-colors">Voir le tableau →</p>
            </div>
          </Link>

          {/* Rock Bottom — bottom 10 interligue */}
          {interleagueStandings.length > 20 && (
            <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden mt-4">
              <div className="bg-rouge/10 px-4 py-3 border-b border-rouge/20 flex items-center gap-2">
                <Skull className="w-4 h-4 text-rouge" />
                <h2 className="font-serif text-sm text-rouge font-medium">Rock Bottom</h2>
              </div>
              <div className="divide-y divide-white/[0.05]">
                <div className="grid grid-cols-[2rem_1fr_4.5rem_3.5rem] px-3 py-2 text-[10px] uppercase tracking-wider text-muted">
                  <span></span>
                  <span>Joueur</span>
                  <span>Ligue</span>
                  <span className="text-right">Points</span>
                </div>
                {interleagueStandings.slice(-10).map((s) => (
                  <Link
                    key={s.userId}
                    href={`/ligue/${s.leagueSlug}/equipe/${s.userId}`}
                    className="grid grid-cols-[2rem_1fr_4.5rem_3.5rem] px-3 py-2 items-center text-xs hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="font-bold text-rouge/70">
                      {s.rank}
                    </span>
                    <span className="text-white/60 truncate flex items-center hover:text-white transition-colors">
                      {s.userName}
                      <TrophyBadges trophies={s.trophies} leagueSlug={s.leagueSlug} />
                    </span>
                    <span className="text-[10px] text-muted truncate">{s.leagueName.replace("Ligue 1 (Baudens League)", "L1").replace("National 1", "Nat. 1").replace("Ligue 2", "L2")}</span>
                    <span className="text-right text-white/50 font-medium tabular-nums">
                      {s.totalPoints.toFixed(1)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          </div>
        </aside>
      </div>
    </div>
  );
}
