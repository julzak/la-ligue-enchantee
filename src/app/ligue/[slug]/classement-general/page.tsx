import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueStandings } from "@/lib/db";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { DeltaBadge } from "@/components/ui/DeltaBadge";

export default async function ClassementGeneralPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const standings = await getLeagueStandings(league.dbId);
  const currentMatchday = standings.currentDay;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-serif text-xl text-white">Classement général</h2>
        <span className="text-sm text-muted">Journée {currentMatchday}</span>
      </div>

      <div className="bg-surface rounded-lg border border-white/[0.07] overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header */}
          <div className="grid grid-cols-[2.5rem_1fr_4.5rem_2rem_3.5rem_3rem_4.5rem_4.5rem_4.5rem_4.5rem_3.5rem_4rem] items-center px-4 py-3 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07] bg-surface-2">
            <span>Pos.</span>
            <span>Ligueur</span>
            <span className="text-right">Total</span>
            <span></span>
            <span className="text-right">Passes</span>
            <span className="text-right">Buts</span>
            <span className="text-right">Note</span>
            <span className="text-right">Pts G</span>
            <span className="text-right">Pts D</span>
            <span className="text-right">Pts M</span>
            <span className="text-right">Pts A</span>
            <span className="text-right">Moy. joueur</span>
          </div>

          {/* Rows */}
          {standings.standings.map((s) => {
            const note = s.totalPoints - s.ptsPas - 2 * s.ptsGls;
            const moyJoueur = currentMatchday > 0
              ? Math.round(s.totalPoints / (currentMatchday * 11) * 100) / 100
              : 0;

            return (
              <div
                key={s.userId}
                className={`grid grid-cols-[2.5rem_1fr_4.5rem_2rem_3.5rem_3rem_4.5rem_4.5rem_4.5rem_4.5rem_3.5rem_4rem] items-center px-4 py-2.5 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.02] transition-colors ${
                  s.rank === 1 ? "bg-gold/[0.04]" : ""
                }`}
              >
                <span className={`text-sm font-medium ${s.rank <= 3 ? "text-gold" : "text-muted"}`}>
                  {s.rank}
                </span>
                <Link
                  href={`/ligue/${slug}/equipe/${s.userId}`}
                  className="text-sm text-white hover:text-gold transition-colors flex items-center gap-1 truncate"
                >
                  {s.userName}
                  <TrophyBadges trophies={s.trophies} leagueSlug={slug} />
                </Link>
                <span className="text-sm text-right text-white font-semibold tabular-nums">
                  {s.totalPoints.toFixed(1)}
                </span>
                <span className="flex justify-center">
                  <DeltaBadge delta={s.delta} />
                </span>
                <span className="text-sm text-right tabular-nums text-white/70">{s.ptsPas}</span>
                <span className="text-sm text-right tabular-nums text-white/70">{s.ptsGls}</span>
                <span className="text-sm text-right tabular-nums text-white/70">{note.toFixed(1)}</span>
                <span className="text-sm text-right tabular-nums text-white/70">{s.ptsGk.toFixed(1)}</span>
                <span className="text-sm text-right tabular-nums text-white/70">{s.ptsDf.toFixed(1)}</span>
                <span className="text-sm text-right tabular-nums text-white/70">{s.ptsMf.toFixed(1)}</span>
                <span className="text-sm text-right tabular-nums text-white/70">{s.ptsSt.toFixed(1)}</span>
                <span className="text-sm text-right tabular-nums text-muted">{moyJoueur.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href={`/ligue/${slug}/resultats`}
          className="text-sm text-gold hover:underline"
        >
          Résultats de la journée →
        </Link>
      </div>
    </div>
  );
}
