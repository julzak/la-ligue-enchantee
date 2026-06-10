"use client";

import { useState } from "react";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getClubLogoUrlByName } from "@/lib/assets";

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

interface LeagueStats {
  vainqueursParJournee: { journee: number; name: string; points: number }[];
  meilleuresJournees: { rank: number; name: string; journee: number; points: number }[];
  topProgressions: { name: string; journee: number; delta: number }[];
}

interface Props {
  playerStats: {
    meilleursJoueurs: StatEntry[];
    meilleursButeurs: StatEntry[];
    meilleursPasseurs: StatEntry[];
    piresJoueurs: StatEntry[];
  };
  leagueStats: LeagueStats;
}

const LIMITS = [10, 20, 50, 100];
const POSITIONS = [
  { value: "", label: "Tous" },
  { value: "GK", label: "Gardiens" },
  { value: "DEF", label: "Défenseurs" },
  { value: "MID", label: "Milieux" },
  { value: "ATT", label: "Attaquants" },
];

export function StatsContent({ playerStats, leagueStats }: Props) {
  const [limit, setLimit] = useState(20);
  const [posFilter, setPosFilter] = useState("");

  function filterEntries(entries: StatEntry[], excludeGK = false): StatEntry[] {
    let filtered = entries;
    if (posFilter) {
      filtered = filtered.filter((e) => e.position === posFilter);
    } else if (excludeGK) {
      filtered = filtered.filter((e) => e.position !== "GK");
    }
    return filtered.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-serif text-lg text-white">Statistiques</h2>

        <div className="flex items-center gap-3">
          {/* Position filter */}
          <div className="flex gap-1">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPosFilter(p.value)}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  posFilter === p.value
                    ? "bg-gold text-night font-medium"
                    : "bg-surface-2 text-muted hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Limit selector */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-surface-2 border border-white/[0.07] rounded px-2 py-1 text-xs text-white"
          >
            {LIMITS.map((l) => (
              <option key={l} value={l}>Top {l}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          <h3 className="font-serif text-base text-gold border-b border-gold/20 pb-2">Stats du championnat</h3>
          <StatCard title="Meilleurs joueurs" unit="pts" entries={filterEntries(playerStats.meilleursJoueurs, true)} formatValue={(v) => v.toFixed(1)} />
          <StatCard title="Meilleurs buteurs" unit="buts" entries={filterEntries(playerStats.meilleursButeurs)} formatValue={(v) => String(v)} />
          <StatCard title="Meilleurs passeurs" unit="passes" entries={filterEntries(playerStats.meilleursPasseurs)} formatValue={(v) => String(v)} />
          <StatCard title="Plus mauvais joueurs" unit="pts" entries={filterEntries(playerStats.piresJoueurs)} formatValue={(v) => v.toFixed(1)} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <h3 className="font-serif text-base text-gold border-b border-gold/20 pb-2">Stats de la ligue</h3>

          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
              <h4 className="font-serif text-sm text-gold">Vainqueurs par journée</h4>
            </div>
            <div className="divide-y divide-white/[0.05] max-h-80 overflow-y-auto">
              {leagueStats.vainqueursParJournee.map((v) => (
                <div key={v.journee} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-muted">J{v.journee}</span>
                  <span className="text-white font-medium">{v.name}</span>
                  <span className="text-gold tabular-nums">{v.points.toFixed(1)} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
              <h4 className="font-serif text-sm text-gold">Meilleures journées</h4>
            </div>
            <div className="divide-y divide-white/[0.05] max-h-80 overflow-y-auto">
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
  if (entries.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center text-muted text-sm">
        Aucun joueur pour ce filtre
      </div>
    );
  }

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
            <PlayerAvatar playerId={top.playerId} name={top.name} size={36} clubLogoUrl={getClubLogoUrlByName(top.club)} />
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
                <PlayerAvatar playerId={entry.playerId} name={entry.name} size={24} clubLogoUrl={getClubLogoUrlByName(entry.club)} />
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
