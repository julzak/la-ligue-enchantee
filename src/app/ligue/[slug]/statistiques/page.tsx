import { notFound } from "next/navigation";
import { getLeagueBySlug, getPlayerStats, getLeagueStats } from "@/lib/db";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getClubLogoUrl } from "@/lib/assets";

interface StatEntry {
  rank: number;
  playerId: number;
  name: string;
  club: string;
  clubId: number;
  position: string;
  value: number;
  days: number;
}

export default async function StatistiquesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [playerStats, leagueStats] = await Promise.all([
    getPlayerStats(20),
    getLeagueStats(league.dbId),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-lg text-white">Statistiques</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column - Stats du championnat */}
        <div className="space-y-6">
          <h3 className="font-serif text-base text-gold border-b border-gold/20 pb-2">Stats du championnat</h3>

          <StatCard title="Meilleurs joueurs" unit="pts" entries={playerStats.meilleursJoueurs} formatValue={(v) => v.toFixed(1)} />
          <StatCard title="Meilleurs buteurs" unit="buts" entries={playerStats.meilleursButeurs} formatValue={(v) => String(v)} />
          <StatCard title="Meilleurs passeurs" unit="passes" entries={playerStats.meilleursPasseurs} formatValue={(v) => String(v)} />
          <StatCard title="Plus mauvais joueurs" unit="pts" entries={playerStats.piresJoueurs} formatValue={(v) => v.toFixed(1)} />
        </div>

        {/* Right column - Stats de la ligue */}
        <div className="space-y-6">
          <h3 className="font-serif text-base text-gold border-b border-gold/20 pb-2">Stats de la ligue</h3>

          {/* Vainqueurs par journée */}
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
              <h4 className="font-serif text-sm text-gold">Vainqueurs par journée</h4>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {leagueStats.vainqueursParJournee.map((v) => (
                <div key={v.journee} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-muted">J{v.journee}</span>
                  <span className="text-white font-medium">{v.name}</span>
                  <span className="text-gold tabular-nums">{v.points.toFixed(1)} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progression par journée */}
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
              <h4 className="font-serif text-sm text-gold">Progression par journée</h4>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {leagueStats.topProgressions.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-muted w-6">{i + 1}</span>
                  <span className="text-white font-medium flex-1">{p.name}</span>
                  <span className="text-muted text-xs mr-3">J{p.journee}</span>
                  <span className="text-vert font-medium tabular-nums">+{p.delta}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meilleures journées */}
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
              <h4 className="font-serif text-sm text-gold">Meilleures journées</h4>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {leagueStats.meilleuresJournees.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-muted w-6">{i + 1}</span>
                  <span className="text-white font-medium flex-1">{m.name}</span>
                  <span className="text-muted text-xs mr-3">J{m.journee}</span>
                  <span className="text-gold font-medium tabular-nums">{m.points.toFixed(1)} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  unit,
  entries,
  formatValue,
}: {
  title: string;
  unit: string;
  entries: StatEntry[];
  formatValue: (v: number) => string;
}) {
  const maxValue = Math.max(...entries.map((e) => e.value));
  const top = entries[0];
  const rest = entries.slice(1);

  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
        <h4 className="font-serif text-sm text-gold">{title}</h4>
        <span className="text-[10px] uppercase tracking-wider text-muted">{unit}</span>
      </div>

      {top && (
        <div className="px-4 py-4 bg-gold/[0.04] border-b border-gold/10">
          <div className="flex items-center gap-3">
            <PlayerAvatar playerId={top.playerId} name={top.name} size={36} clubLogoUrl={getClubLogoUrl(top.clubId)} />
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate">{top.name}</div>
              <div className="text-muted text-xs">{top.club} - {top.days} matchs</div>
            </div>
            <div className="text-gold font-bold text-lg tabular-nums">{formatValue(top.value)}</div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full rounded-full bg-gold" style={{ width: "100%" }} />
          </div>
        </div>
      )}

      <div className="divide-y divide-white/[0.05]">
        {rest.map((entry) => {
          const pct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;
          return (
            <div key={entry.rank} className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-5 text-xs font-medium shrink-0 ${entry.rank <= 3 ? "text-gold" : "text-muted"}`}>
                  {entry.rank}
                </span>
                <PlayerAvatar playerId={entry.playerId} name={entry.name} size={24} clubLogoUrl={getClubLogoUrl(entry.clubId)} />
                <span className="flex-1 text-sm text-white truncate">{entry.name}</span>
                <span className="text-white font-medium text-sm tabular-nums shrink-0 w-12 text-right">
                  {formatValue(entry.value)}
                </span>
              </div>
              <div className="mt-1.5 ml-8 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gold/60 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
