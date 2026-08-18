export const revalidate = 300; // ISR: refresh every 5 min

import { Suspense } from "react";
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
  getCupContextForDay,
  getCupChampion,
  getRecentJokers,
} from "@/lib/db";
import { RecentJokersCard } from "@/components/jokers/RecentJokersCard";
import { getClubLogoUrlByName, getClubShortNameByName, canonicalClubKey } from "@/lib/assets";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { MatchCard } from "@/components/scoring/MatchCard";
import { ChevronRight, Flame, ThumbsDown, Skull, Trophy } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { prisma } from "@/lib/prisma";

// ── Skeleton loaders ────────────────────────────────────
function CardSkeleton({ cols = 3 }: { cols?: number }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-${cols}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="bg-surface rounded-lg border border-white/[0.07] p-4 h-24 animate-pulse" />
      ))}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="bg-gold/10 px-4 py-3 border-b border-gold/20">
        <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
      </div>
      <div className="space-y-1 p-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-8 bg-white/[0.03] rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ── Async sections ──────────────────────────────────────
async function CupBadgesSection() {
  const currentDay = await getCurrentMatchday();
  const [champion, upcoming, last] = await Promise.all([
    getCupChampion(),
    getCupContextForDay(currentDay + 1),
    getCupContextForDay(currentDay),
  ]);

  if (champion) {
    return (
      <Link
        href="/coupe"
        className="block bg-gradient-to-r from-gold/[0.18] via-gold/[0.10] to-gold/[0.18] rounded-lg border border-gold/50 px-5 py-4 hover:border-gold/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-gold shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-base text-white font-serif">
              🔥 Félicitations à <span className="font-bold text-gold">{champion.championName}</span>, vainqueur de la {champion.cupName} {champion.season} 🏆
            </p>
            <p className="text-[11px] text-muted mt-0.5">Voir le tableau de la coupe →</p>
          </div>
        </div>
      </Link>
    );
  }

  if (!upcoming && !last) return null;

  return (
    <div className="space-y-3">
      {upcoming && (
        <Link
          href="/coupe"
          className="block bg-gradient-to-r from-gold/[0.12] to-gold/[0.04] rounded-lg border border-gold/40 px-4 py-3 hover:border-gold/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <span className="font-semibold">{upcoming.round}</span> de la {upcoming.cupName} — <span className="text-gold">J{upcoming.matchday}</span>
              </p>
              <p className="text-[11px] text-muted">Voir le tableau de la coupe →</p>
            </div>
          </div>
        </Link>
      )}
      {last && (
        <Link
          href="/coupe"
          className="block bg-surface rounded-lg border border-gold/20 px-4 py-3 hover:border-gold/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                Résultats des <span className="font-semibold">{last.round}</span> — J{last.matchday}
              </p>
              <p className="text-[11px] text-muted">Voir le tableau de la coupe →</p>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

async function RecentJokersSection() {
  // Règle de gestion (Pierre, 2026-08-18) : les 5 derniers jokers toujours
  // affichés, et jusqu'à 10 pour ceux posés dans les 48 dernières heures.
  // 5 quand il ne se passe pas grand-chose, 10 en août-septembre où ça flambe.
  const all = await getRecentJokers({ limit: 10 });
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const jokers = all.filter(
    (j, i) => i < 5 || (j.createdAt !== null && j.createdAt.getTime() >= cutoff)
  );
  if (jokers.length === 0) return null;
  return <RecentJokersCard jokers={jokers} variant="home" />;
}

async function DayStatsSection() {
  const dayStats = await getDayStats();
  return (
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
  );
}

async function PerformancesSection() {
  const [bestPerformances, worstPerformances] = await Promise.all([
    getBestPerformances(),
    getWorstPerformances(),
  ]);
  return (
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
  );
}

async function MatchResultsSection() {
  const currentMatchday = await getCurrentMatchday();
  const [matchRatings, dbMatches] = await Promise.all([
    getMatchPlayerRatings(currentMatchday),
    prisma.$queryRawUnsafe<{
      home_team: string; away_team: string; home_score: number | null; away_score: number | null;
    }[]>(
      "SELECT home_team, away_team, home_score, away_score FROM MATCH_SCHEDULE WHERE matchday = ? AND home_score IS NOT NULL ORDER BY match_date",
      currentMatchday
    ),
  ]);

  if (dbMatches.length === 0) return null;

  return (
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

          return (
            <MatchCard
              key={`${m.home_team}-${m.away_team}`}
              homeClub={getClubShortNameByName(m.home_team, m.home_team)}
              awayClub={getClubShortNameByName(m.away_team, m.away_team)}
              homeLogo={getClubLogoUrlByName(m.home_team)}
              awayLogo={getClubLogoUrlByName(m.away_team)}
              homeScore={m.home_score ?? 0}
              awayScore={m.away_score ?? 0}
              homeRatings={matchRatings.get(canonicalClubKey(m.home_team)) ?? []}
              awayRatings={matchRatings.get(canonicalClubKey(m.away_team)) ?? []}
            />
          );
        })}
      </div>
    </details>
  );
}

async function LeagueSummariesSection() {
  const leagues = await getLeagues();
  const leagueStandingsResults = await Promise.all(
    leagues.map((league) => getLeagueStandings(league.dbId))
  );
  const leagueStandingsMap = new Map<string, Awaited<ReturnType<typeof getLeagueStandings>>>();
  leagues.forEach((league, i) => {
    leagueStandingsMap.set(league.slug, leagueStandingsResults[i]);
  });

  return (
    <div>
      <h2 className="font-serif text-lg text-white mb-4">Les ligues</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* getLeagues renvoie déjà l'ordre des divisions (tier croissant) ;
            l'ancien tri par slugs codés en dur ne connaissait pas les
            nouvelles ligues et scramblait l'ordre. */}
        {leagues.map((league) => {
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
  );
}

async function SidebarContent() {
  const [interleagueStandings, currentDay] = await Promise.all([
    getInterleagueStandings(),
    getCurrentMatchday(),
  ]);
  const [cupUpcoming, cupLast] = await Promise.all([
    getCupContextForDay(currentDay + 1),
    getCupContextForDay(currentDay),
  ]);
  const cupStatus = cupUpcoming
    ? { label: `${cupUpcoming.round} à venir`, sub: `J${cupUpcoming.matchday}` }
    : cupLast
    ? { label: `Résultats ${cupLast.round}`, sub: `J${cupLast.matchday}` }
    : null;
  return (
    <>
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
          {cupStatus ? (
            <>
              <p className="text-sm text-white/70">{cupStatus.label}</p>
              <p className="text-xs text-muted mt-1">{cupStatus.sub}</p>
            </>
          ) : (
            <p className="text-sm text-white/70">Tableau complet</p>
          )}
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
    </>
  );
}

// ── Main page ───────────────────────────────────────────
export default async function HomePage() {
  const currentMatchday = await getCurrentMatchday();

  // Cartes de raccourci construites depuis les ligues réelles : les anciennes
  // cartes codées en dur pointaient /ligue/national-1, une URL morte depuis la
  // saison 2026-2027 (404 signalé par les participants). Logos réutilisés
  // quand le nom correspond, initiale dorée sinon.
  const quickLeagues = await getLeagues();
  const leagueImg = (name: string): string | null => {
    if (/^ligue 1/i.test(name)) return "/leagues/ligue1.svg";
    if (/^ligue 2/i.test(name)) return "/leagues/ligue2.png";
    if (/^ligue 3/i.test(name)) return "/leagues/ligue3.svg";
    if (/national/i.test(name)) return "/leagues/national.png";
    return null;
  };
  const quickLinks = [
    ...quickLeagues.map((l) => ({
      href: `/ligue/${l.slug}/classement`,
      label: l.name,
      img: leagueImg(l.name),
      bg: leagueImg(l.name) ? "bg-white" : "bg-gold/20",
      invert: false,
      fallback: l.name[0]?.toUpperCase() ?? "?",
    })),
    { href: "/coupe", label: "Coupe", img: "/leagues/coupe.png", bg: "bg-[#1B2A5B]", invert: true, fallback: "C" },
    { href: "/forum", label: "Forum", img: null, bg: "bg-gold/20", invert: false, fallback: "💬" },
  ];

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
            <h1 className="font-serif text-3xl text-gold mb-2">{currentMatchday > 0 ? `Journée ${currentMatchday}` : "Saison à venir"}</h1>
            <p className="text-xs text-white/30 italic tracking-wide">La fantasy league est une affaire sérieuse</p>
            {/* Quick links — visual cards with logos */}
            <div className="flex justify-center gap-3 mt-5 flex-wrap">
              {quickLinks.map((item) => (
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
                      <span className="text-gold text-lg font-serif">{item.fallback}</span>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted group-hover:text-gold transition-colors text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <Suspense fallback={null}>
            <CupBadgesSection />
          </Suspense>

          <Suspense fallback={null}>
            <RecentJokersSection />
          </Suspense>

          <Suspense fallback={<CardSkeleton cols={3} />}>
            <DayStatsSection />
          </Suspense>

          <Suspense fallback={<CardSkeleton cols={2} />}>
            <PerformancesSection />
          </Suspense>

          <Suspense fallback={null}>
            <MatchResultsSection />
          </Suspense>

          <Suspense fallback={<CardSkeleton />}>
            <LeagueSummariesSection />
          </Suspense>
        </div>

        {/* Sidebar - Classement interligue */}
        <aside className="w-full lg:w-80 lg:shrink-0">
          <div className="sticky top-6 space-y-4">
            <Suspense fallback={<SidebarSkeleton />}>
              <SidebarContent />
            </Suspense>
          </div>
        </aside>
      </div>
    </div>
  );
}
