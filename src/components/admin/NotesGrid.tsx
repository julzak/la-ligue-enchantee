"use client";

import { useState } from "react";
import type { Performance, Position } from "@/lib/types";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { calculatePlayerPoints } from "@/lib/scoring";

interface NotesGridPlayer {
  id: string;
  name: string;
  position: Position;
  clubShortName: string;
}

interface NotesGridProps {
  matchLabel: string;
  players: NotesGridPlayer[];
  initialPerformances: Map<string, Performance>;
}

export function NotesGrid({ matchLabel, players, initialPerformances }: NotesGridProps) {
  const [perfs, setPerfs] = useState<Map<string, Performance>>(initialPerformances);

  function getPerf(playerId: string): Performance {
    return perfs.get(playerId) ?? {
      playerId,
      matchday: 27,
      minutesPlayed: 90,
      rating: null,
      goals: 0,
      assists: 0,
      ownGoals: 0,
      redCard: false,
      penaltySaved: 0,
      penaltyMissed: 0,
    };
  }

  function updatePerf(playerId: string, updates: Partial<Performance>) {
    setPerfs((prev) => {
      const next = new Map(prev);
      const current = getPerf(playerId);
      next.set(playerId, { ...current, ...updates });
      return next;
    });
  }

  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.07]">
        <h3 className="text-sm font-medium text-white">{matchLabel}</h3>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[2rem_3rem_1fr_4rem_3.5rem_3rem_3rem_2.5rem_2.5rem_2.5rem_4rem] gap-1 px-3 py-2 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07]">
        <span></span>
        <span>Pos</span>
        <span>Nom</span>
        <span className="text-center">Min</span>
        <span className="text-center">Note</span>
        <span className="text-center">Buts</span>
        <span className="text-center">Pass</span>
        <span className="text-center">CR</span>
        <span className="text-center">CSC</span>
        <span className="text-center">PA</span>
        <span className="text-right">Total</span>
      </div>

      {/* Rows */}
      {players.map((player, idx) => {
        const perf = getPerf(player.id);
        const breakdown = calculatePlayerPoints(perf, player.position);
        const hasRedCard = perf.redCard;
        const hasHighRating = perf.rating !== null && perf.rating !== undefined && perf.rating >= 7;

        return (
          <div
            key={player.id}
            className={`grid grid-cols-[2rem_3rem_1fr_4rem_3.5rem_3rem_3rem_2.5rem_2.5rem_2.5rem_4rem] gap-1 px-3 py-1.5 items-center border-b border-white/[0.05] last:border-b-0 ${
              hasRedCard
                ? "bg-rouge/[0.08]"
                : hasHighRating
                ? "bg-gold/[0.05]"
                : idx % 2 === 0
                ? ""
                : "bg-white/[0.01]"
            }`}
          >
            <span className="text-xs text-muted">{idx + 1}</span>
            <PositionBadge position={player.position} />
            <div className="min-w-0">
              <span className="text-xs text-white truncate block">{player.name}</span>
              <span className="text-[10px] text-muted">{player.clubShortName}</span>
            </div>

            {/* Minutes */}
            <input
              type="number"
              value={perf.minutesPlayed ?? ""}
              onChange={(e) => updatePerf(player.id, { minutesPlayed: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-1.5 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
              min={0}
              max={120}
            />

            {/* Note */}
            <input
              type="number"
              value={perf.rating ?? ""}
              onChange={(e) => updatePerf(player.id, { rating: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-1.5 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
              min={0}
              max={10}
              step={0.5}
            />

            {/* Goals */}
            <input
              type="number"
              value={perf.goals}
              onChange={(e) => updatePerf(player.id, { goals: Number(e.target.value) || 0 })}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
              min={0}
            />

            {/* Assists */}
            <input
              type="number"
              value={perf.assists}
              onChange={(e) => updatePerf(player.id, { assists: Number(e.target.value) || 0 })}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
              min={0}
            />

            {/* Red card */}
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={perf.redCard}
                onChange={(e) => updatePerf(player.id, { redCard: e.target.checked })}
                className="accent-rouge"
              />
            </div>

            {/* Own goals */}
            <input
              type="number"
              value={perf.ownGoals}
              onChange={(e) => updatePerf(player.id, { ownGoals: Number(e.target.value) || 0 })}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
              min={0}
            />

            {/* Penalty saved */}
            <input
              type="number"
              value={perf.penaltySaved}
              onChange={(e) => updatePerf(player.id, { penaltySaved: Number(e.target.value) || 0 })}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
              min={0}
            />

            {/* Calculated total */}
            <span className={`text-xs font-semibold text-right tabular-nums ${hasRedCard ? "text-rouge" : "text-white"}`}>
              {breakdown.total.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
