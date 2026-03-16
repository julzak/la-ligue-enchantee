import { ClassementTable } from "@/components/classement/ClassementTable";
import { getLeagueBySlug, getLeagueStandings } from "@/lib/db";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { Crown, TrendingUp, TrendingDown, Target } from "lucide-react";
import Link from "next/link";
import { TopoJournee } from "@/components/classement/TopoJournee";
import { notFound } from "next/navigation";
import type { Standing, Participant } from "@/lib/types";

const forumExcerpts = [
  { title: "Jokers 2025-2026", author: "DimitriS", excerpt: "hello apka auxerre out balerdi om in ..." },
  { title: "Jokers 2025-2026", author: "tom p", excerpt: "Hello Jokers a jour pour la j25 Recap => Blek le roc : 2 jokers..." },
  { title: "Résultats journée 24", author: "laurent", excerpt: "Magnifique, Quelle belle inspiration..." },
];

export default async function ClassementPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const league = await getLeagueBySlug(slug);
  if (!league) {
    notFound();
  }

  const standings = await getLeagueStandings(league.dbId);
  const currentMatchday = standings.currentDay;

  // ClassementTable = "Classement de la journée" -> sorted by day score, no delta (delta is for general)
  const dayRanked = [...standings.standings]
    .sort((a, b) => b.lastMatchdayPoints - a.lastMatchdayPoints);

  const tableStandings: Standing[] = dayRanked.map((s, i) => ({
    rank: i + 1,
    participantId: String(s.userId),
    participantName: s.userName,
    totalPoints: s.totalPoints,
    lastMatchdayPoints: s.lastMatchdayPoints,
    ptsPerDay: s.ptsPerDay,
    delta: 0, // pas de delta dans le classement de la journée
  }));

  const participants: Participant[] = standings.standings.map((s) => ({
    id: String(s.userId),
    name: s.userName,
    avatarInitials: s.initials,
    trophies: s.trophies,
  }));

  const leader = standings.standings[0];
  if (!leader) {
    return <div className="text-muted p-8">Aucun classement disponible</div>;
  }

  // Top progressions and biggest drops
  const progressions = standings.standings
    .filter((s) => s.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const drops = standings.standings
    .filter((s) => s.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  const top5 = standings.standings.slice(0, 5);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left column - Classement */}
      <div className="w-full lg:w-72 lg:shrink-0 overflow-x-auto">
        <ClassementTable standings={tableStandings} participants={participants} />
      </div>

      {/* Center */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* L'homme a abattre */}
        <div className="bg-gradient-to-r from-gold/[0.08] to-transparent rounded-lg border border-gold/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gold/20 border-2 border-gold flex items-center justify-center">
              <Crown className="w-7 h-7 text-gold" fill="#C8A84B" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gold-dim mb-1">L&apos;homme a abattre</p>
              <p className="text-lg font-serif text-white flex items-center gap-2">
                {leader.userName}
                <TrophyBadges trophies={leader.trophies} />
              </p>
              <p className="text-sm text-muted">
                {leader.totalPoints.toFixed(1)} pts - {leader.lastMatchdayPoints.toFixed(1)} pts a la J{currentMatchday}
              </p>
            </div>
          </div>
        </div>

        {/* Progressions & Chutes - big and prominent */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Progressions */}
          <div className="bg-surface rounded-lg border border-vert/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-vert" />
              <h3 className="text-sm font-semibold text-vert uppercase tracking-wider">Top progressions</h3>
            </div>
            {progressions.length > 0 ? (
              <div className="space-y-3">
                {progressions.map((s) => (
                  <div key={s.userId} className="flex items-center gap-3">
                    <span className="text-2xl font-serif font-bold text-vert">+{s.delta}</span>
                    <span className="text-xl">🔥</span>
                    <div>
                      <span className="text-sm text-white flex items-center gap-1">
                        {s.userName}
                        <TrophyBadges trophies={s.trophies} />
                      </span>
                      <span className="text-xs text-muted">{s.lastMatchdayPoints.toFixed(1)} pts J{currentMatchday} - maintenant {s.rank}e</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Pas de progression cette journée</p>
            )}
          </div>

          {/* Chutes */}
          <div className="bg-surface rounded-lg border border-rouge/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-rouge" />
              <h3 className="text-sm font-semibold text-rouge uppercase tracking-wider">Plus grosses chutes</h3>
            </div>
            {drops.length > 0 ? (
              <div className="space-y-3">
                {drops.map((s) => (
                  <div key={s.userId} className="flex items-center gap-3">
                    <span className="text-2xl font-serif font-bold text-rouge">{s.delta}</span>
                    <span className="text-xl">🌭</span>
                    <div>
                      <span className="text-sm text-white flex items-center gap-1">
                        {s.userName}
                        <TrophyBadges trophies={s.trophies} />
                      </span>
                      <span className="text-xs text-muted">{s.lastMatchdayPoints.toFixed(1)} pts J{currentMatchday} - tombe à la {s.rank}e place</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Pas de chute cette journée</p>
            )}
          </div>
        </div>

        {/* CTA classement général */}
        <Link
          href={`/ligue/${slug}/classement-general`}
          className="block bg-gradient-to-r from-gold/[0.06] to-gold/[0.02] rounded-lg border border-gold/20 p-4 text-center hover:border-gold/40 transition-colors group"
        >
          <span className="text-sm font-serif text-gold group-hover:text-white transition-colors">
            Arrêtez ce suspense → Découvrir le classement général
          </span>
        </Link>

        {/* Topo IA */}
        <TopoJournee matchday={currentMatchday} leagueName={league.name} />

        {/* Stats - compact */}
        <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-sm text-white/60">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span><Target className="w-3 h-3 inline mr-1 text-muted" />{standings.pointsJournee.toFixed(1)} pts journée</span>
            <span>{standings.standings.length} participants</span>
            <span>{standings.ratio.toFixed(2)} pts/participant</span>
            <span>{standings.totalPoints.toLocaleString("fr-FR")} pts cumulés</span>
          </div>
        </div>

      </div>

      {/* Right sidebar */}
      <aside className="w-full xl:w-64 xl:shrink-0 space-y-6">
        {/* Tête de ligue */}
        <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
          <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
            <h3 className="font-serif text-sm text-gold">Tête de ligue</h3>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {top5.map((s) => (
              <div key={s.userId} className="flex items-center px-3 py-2 text-xs">
                <span className={`w-5 font-medium ${s.rank <= 3 ? "text-gold" : "text-muted"}`}>{s.rank}</span>
                <span className="flex-1 text-white truncate flex items-center">
                  {s.userName}
                  <TrophyBadges trophies={s.trophies} />
                </span>
                <span className="text-white font-medium tabular-nums">{s.totalPoints.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <Link
            href={`/ligue/${slug}/classement-general`}
            className="block px-4 py-2.5 text-center text-xs font-medium text-gold hover:bg-gold/5 border-t border-white/[0.07] transition-colors"
          >
            Classement général complet →
          </Link>
        </div>

        {/* Perles du forum - bigger */}
        <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
          <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
            <h3 className="font-serif text-sm text-rouge">Perles du forum</h3>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {forumExcerpts.map((post, i) => (
              <div key={i} className="px-3 py-3">
                <Link href={`/ligue/${slug}/forum`} className="text-xs text-gold hover:underline font-medium block mb-1.5">
                  {post.title}
                </Link>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  <span className="text-white/80 font-semibold">{post.author} : </span>
                  {post.excerpt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
