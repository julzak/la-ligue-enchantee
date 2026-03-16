"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Player, Performance, PlayerPointsBreakdown } from "@/lib/types";
import { PlayerPerformance } from "./PlayerPerformance";

interface PlayerScoreEntry {
  player: Player;
  clubShortName: string;
  performance: Performance | undefined;
  breakdown: PlayerPointsBreakdown;
}

interface JourneeScoreProps {
  participantName: string;
  avatarInitials: string;
  totalScore: number;
  seasonRank: number;
  playerScores: PlayerScoreEntry[];
  defaultOpen?: boolean;
}

export function JourneeScore({
  participantName,
  avatarInitials,
  totalScore,
  seasonRank,
  playerScores,
  defaultOpen = false,
}: JourneeScoreProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-full bg-surface-2 border border-white/[0.07] flex items-center justify-center text-[10px] font-medium text-white/50 shrink-0">
          {avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white block truncate">{participantName}</span>
          <span className="text-xs text-muted">{seasonRank}e au classement</span>
        </div>
        <span className="text-xl font-serif font-bold text-gold tabular-nums">
          {totalScore.toFixed(1)}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Content - collapsible */}
      {open && (
        <div className="border-t border-white/[0.07] px-1 py-1">
          {playerScores.map((ps) => (
            <PlayerPerformance
              key={ps.player.id}
              player={ps.player}
              clubShortName={ps.clubShortName}
              performance={ps.performance}
              breakdown={ps.breakdown}
            />
          ))}
        </div>
      )}
    </div>
  );
}
