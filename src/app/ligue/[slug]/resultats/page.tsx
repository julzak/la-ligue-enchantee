import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueStandings } from "@/lib/db";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { DeltaBadge } from "@/components/ui/DeltaBadge";

export default async function ResultatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const standings = await getLeagueStandings(league.dbId);
  const currentMatchday = standings.currentDay;

  // Sort by matchday score (not cumulative)
  const dayRanked = [...standings.standings]
    .sort((a, b) => b.lastMatchdayPoints - a.lastMatchdayPoints);

  const best = dayRanked[0];
  const worst = dayRanked[dayRanked.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-serif text-xl text-white">Résultats de la journée {currentMatchday}</h2>
      </div>

      {/* Highlights */}
      {best && worst && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-surface rounded-lg border-l-2 border-l-vert border border-white/[0.07] p-4">
            <p className="text-[10px] uppercase tracking-widest text-vert mb-1">L&apos;exploit de la journée</p>
            <p className="text-sm text-white font-medium flex items-center gap-1">
              {best.userName} <TrophyBadges trophies={best.trophies} leagueSlug={slug} />
            </p>
            <p className="text-xs text-muted mt-1">{best.lastMatchdayPoints} pts</p>
          </div>
          <div className="bg-surface rounded-lg border-l-2 border-l-rouge border border-white/[0.07] p-4">
            <p className="text-[10px] uppercase tracking-widest text-rouge mb-1">La saucisse de la journée 🌭</p>
            <p className="text-sm text-white font-medium flex items-center gap-1">
              {worst.userName} <TrophyBadges trophies={worst.trophies} leagueSlug={slug} />
            </p>
            <p className="text-xs text-muted mt-1">{worst.lastMatchdayPoints} pts</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface rounded-lg border border-white/[0.07] overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[2.5rem_1fr_3rem_4.5rem_2rem_4.5rem] items-center px-4 py-3 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07] bg-surface-2">
            <span>Pos.</span>
            <span>Ligueur</span>
            <span className="text-right">Class.</span>
            <span className="text-right">Total</span>
            <span></span>
            <span className="text-right">Pts/joueur</span>
          </div>

          {dayRanked.map((s, i) => {
            const dayPts = s.lastMatchdayPoints;
            const ptsPerJoueur = dayPts > 0 ? Math.round(dayPts / 11 * 100) / 100 : 0;

            return (
              <div
                key={s.userId}
                className={`grid grid-cols-[2.5rem_1fr_3rem_4.5rem_2rem_4.5rem] items-center px-4 py-2.5 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.02] transition-colors ${
                  i === 0 ? "bg-gold/[0.04]" : i === dayRanked.length - 1 ? "bg-rouge/[0.04]" : ""
                }`}
              >
                <span className={`text-sm font-medium ${i < 3 ? "text-gold" : "text-muted"}`}>{i + 1}</span>
                <Link
                  href={`/ligue/${slug}/equipe/${s.userId}?j=${currentMatchday}`}
                  className="text-sm text-white hover:text-gold transition-colors flex items-center gap-1 truncate"
                >
                  {s.userName}
                  <TrophyBadges trophies={s.trophies} leagueSlug={slug} />
                </Link>
                <span className="text-sm text-right tabular-nums text-muted">{s.rank}</span>
                <span className="text-sm text-right tabular-nums text-white font-semibold">{dayPts.toFixed(1)}</span>
                <span className="flex justify-center"><DeltaBadge delta={s.delta} /></span>
                <span className="text-sm text-right tabular-nums text-muted">{ptsPerJoueur.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Link href={`/ligue/${slug}/classement-general`} className="text-sm text-gold hover:underline">
          Classement général →
        </Link>
      </div>
    </div>
  );
}
