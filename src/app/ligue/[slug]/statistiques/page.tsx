"use client";

import { useParams } from "next/navigation";
import { getLeague, getLeagueStandings, players, getClub, getPlayer, currentMatchday } from "@/lib/fixtures";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";

interface StatEntry {
  rank: number;
  name: string;
  club: string;
  position: string;
  value: number;
  playerId: string;
  imageUrl?: string;
}

// Deterministic mock stats from player data
function getTopPlayers(category: string, count: number): StatEntry[] {
  const sorted = [...players].sort((a, b) => {
    const hashA = (a.id + category).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hashB = (b.id + category).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return hashB - hashA;
  });

  return sorted.slice(0, count).map((p, i) => {
    const hash = (p.id + category).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const club = getClub(p.clubId);
    const player = getPlayer(p.id);
    let value: number;
    switch (category) {
      case "meilleurs":
        value = Math.round((180 + (hash % 80)) * 10) / 10;
        break;
      case "buteurs":
        value = 12 - i + (hash % 3);
        break;
      case "passeurs":
        value = 10 - i + (hash % 3);
        break;
      case "pires":
        value = Math.round((50 + (hash % 30)) * 10) / 10;
        break;
      default:
        value = hash % 100;
    }
    return {
      rank: i + 1,
      name: p.name,
      club: club?.shortName ?? "",
      position: p.position,
      value,
      playerId: p.id,
      imageUrl: player?.imageUrl,
    };
  });
}

export default function StatistiquesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const league = getLeague(slug);
  const standings = getLeagueStandings(slug);

  if (!league || !standings) {
    return <div className="text-muted p-8">Ligue non trouvée</div>;
  }

  const meilleursJoueurs = getTopPlayers("meilleurs", 10);
  const meilleursButeurs = getTopPlayers("buteurs", 10);
  const meilleursPasseurs = getTopPlayers("passeurs", 10);
  const piresJoueurs = getTopPlayers("pires", 10);

  // Mock "vainqueurs par journée"
  const vainqueursParJournee = Array.from({ length: Math.min(currentMatchday, 10) }, (_, i) => {
    const j = currentMatchday - i;
    const winner = standings.standings[j % standings.standings.length];
    const hash = (winner.participantId + j).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      journee: j,
      name: winner.participantName,
      points: Math.round((45 + (hash % 25)) * 10) / 10,
    };
  });

  // Mock "meilleures journées" (top single-matchday scores)
  const meilleuresJournees = standings.standings
    .slice(0, 10)
    .map((s, i) => {
      const hash = s.participantId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return {
        rank: i + 1,
        name: s.participantName,
        journee: 5 + (hash % 20),
        points: Math.round((65 + (hash % 20)) * 10) / 10,
      };
    })
    .sort((a, b) => b.points - a.points);

  // Mock "progression par journée" (biggest delta ever)
  const progressions = standings.standings
    .slice(0, 10)
    .map((s, i) => {
      const hash = s.participantId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return {
        rank: i + 1,
        name: s.participantName,
        journee: 3 + (hash % 22),
        delta: 5 + (hash % 8),
      };
    })
    .sort((a, b) => b.delta - a.delta);

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-lg text-white">Statistiques</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column - Stats du championnat */}
        <div className="space-y-6">
          <h3 className="font-serif text-base text-gold border-b border-gold/20 pb-2">Stats du championnat</h3>

          <StatCard title="Meilleurs joueurs" unit="pts" entries={meilleursJoueurs} formatValue={(v) => v.toFixed(1)} />
          <StatCard title="Meilleurs buteurs" unit="buts" entries={meilleursButeurs} formatValue={(v) => String(v)} />
          <StatCard title="Meilleurs passeurs" unit="passes" entries={meilleursPasseurs} formatValue={(v) => String(v)} />
          <StatCard title="Plus mauvais joueurs" unit="pts" entries={piresJoueurs} formatValue={(v) => v.toFixed(1)} />
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
              {vainqueursParJournee.map((v) => (
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
              {progressions.map((p, i) => (
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
              {meilleuresJournees.map((m, i) => (
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

      {/* Top player highlight */}
      {top && (
        <div className="px-4 py-4 bg-gold/[0.04] border-b border-gold/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <PlayerAvatar imageUrl={top.imageUrl} name={top.name} size={48} />
              <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gold text-night text-[10px] font-bold flex items-center justify-center">
                1
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-base truncate">{top.name}</div>
              <div className="text-muted text-xs">{top.club} · {top.position}</div>
            </div>
            <div className="text-gold font-bold text-lg tabular-nums">{formatValue(top.value)}</div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}

      {/* Remaining players */}
      <div className="divide-y divide-white/[0.05]">
        {rest.map((entry) => {
          const pct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;
          return (
            <div key={entry.rank} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className={`w-5 text-xs font-medium shrink-0 ${entry.rank <= 3 ? "text-gold" : "text-muted"}`}>
                  {entry.rank}
                </span>
                <PlayerAvatar imageUrl={entry.imageUrl} name={entry.name} size={28} />
                <span className="flex-1 text-sm text-white truncate">{entry.name}</span>
                <span className="text-muted text-xs mr-2 shrink-0">{entry.club}</span>
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
