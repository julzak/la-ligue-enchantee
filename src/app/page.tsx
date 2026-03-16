import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import {
  leagues,
  leagueStandings,
  interleagueStandings,
  bestPerformances,
  dayStats,
  currentMatchday,
} from "@/lib/fixtures";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { getParticipant, getLeagueForParticipant } from "@/lib/fixtures";
import { ChevronRight, Flame, ThumbsDown } from "lucide-react";

// Mock worst performances (Onze des Saucisses)
const worstPerformances = [
  { playerName: "Steve Mandanda", club: "SRFC", points: 2.0, detail: "3.0 pts, 0 action" },
  { playerName: "Nico C", club: "MHSC", points: 2.5, detail: "2.5 pts, remplace a 30 min" },
  { playerName: "Nico B", club: "FCN", points: 3.0, detail: "3.0 pts, carton jaune" },
  { playerName: "Yunis Abdelhamid", club: "SDR", points: 3.0, detail: "3.0 pts, CSC" },
  { playerName: "Teji Savanier", club: "MHSC", points: 3.5, detail: "3.5 pts, invisible" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <nav className="h-[52px] bg-surface border-b border-white/[0.07] flex items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-gold font-serif text-sm">La Ligue Enchantée</span>
        </Link>
        <div className="flex-1" />
        <span className="text-xs font-medium bg-gold text-night px-2.5 py-1 rounded">
          J{currentMatchday}
        </span>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Matchday header */}
          <div className="bg-surface rounded-lg border border-white/[0.07] p-6 text-center">
            <h1 className="font-serif text-3xl text-gold mb-2">Journée {currentMatchday}</h1>
            <p className="text-sm text-white/50 max-w-lg mx-auto">
              Affrontez vos amis au sein d&apos;une ligue de football !
            </p>
          </div>

          {/* Day results */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
              <span className="text-3xl font-serif font-bold text-gold">{dayStats.totalGoals}</span>
              <p className="text-xs text-muted mt-1">Buts marqués</p>
            </div>
            <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
              <span className="text-3xl font-serif font-bold text-white">{dayStats.totalPoints.toFixed(0)}</span>
              <p className="text-xs text-muted mt-1">Points cumulés</p>
            </div>
            <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
              <span className="text-3xl font-serif font-bold text-white/70">{dayStats.avgPerPlayer.toFixed(2)}</span>
              <p className="text-xs text-muted mt-1">Pts par joueur</p>
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

          {/* League summaries */}
          <div>
            <h2 className="font-serif text-lg text-white mb-4">Les ligues</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leagues.map((league) => {
                const stats = leagueStandings[league.slug];
                if (!stats) return null;
                const leaderName = stats.standings[0]?.participantName ?? "";
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
                        <span className="text-white">{league.participantCount}</span>
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
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden sticky top-6">
            <div className="bg-gold/10 px-4 py-3 border-b border-gold/20">
              <h2 className="font-serif text-sm text-gold font-medium">Classement interligue</h2>
            </div>
            <div className="divide-y divide-white/[0.05]">
              <div className="grid grid-cols-[2rem_1fr_4.5rem_3.5rem] px-3 py-2 text-[10px] uppercase tracking-wider text-muted">
                <span></span>
                <span>Joueur</span>
                <span>Ligue</span>
                <span className="text-right">Points</span>
              </div>
              {interleagueStandings.map((s) => {
                const participant = getParticipant(s.participantId);
                const pLeague = getLeagueForParticipant(s.participantId);
                return (
                  <Link
                    key={s.participantId}
                    href={pLeague ? `/ligue/${pLeague.slug}/equipe/${s.participantId}` : "#"}
                    className="grid grid-cols-[2rem_1fr_4.5rem_3.5rem] px-3 py-2 items-center text-xs hover:bg-white/[0.04] transition-colors"
                  >
                    <span className={`font-bold ${s.rank <= 3 ? "text-gold" : "text-muted"}`}>
                      {s.rank}
                    </span>
                    <span className="text-white truncate flex items-center hover:text-gold transition-colors">
                      {s.participantName}
                      {participant && <TrophyBadges trophies={participant.trophies} />}
                    </span>
                    <span className="text-[10px] text-muted truncate">{s.leagueName.replace("Ligue 1 (Baudens League)", "L1").replace("National 1", "Nat. 1").replace("Ligue 2", "L2")}</span>
                    <span className="text-right text-white font-medium tabular-nums">
                      {s.totalPoints.toFixed(1)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
