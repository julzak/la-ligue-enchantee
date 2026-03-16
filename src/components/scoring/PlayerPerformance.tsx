"use client";

import type { Player, Performance, PlayerPointsBreakdown } from "@/lib/types";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";

interface PlayerPerformanceProps {
  player: Player;
  clubShortName: string;
  performance: Performance | undefined;
  breakdown: PlayerPointsBreakdown;
}

export function PlayerPerformance({ player, clubShortName, performance, breakdown }: PlayerPerformanceProps) {
  const rating = performance?.rating;
  const ratingColor = rating !== null && rating !== undefined
    ? rating >= 7 ? "text-gold" : rating < 5 ? "text-muted" : "text-white/80"
    : "text-muted";

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded hover:bg-white/[0.02] transition-colors">
      {/* Position */}
      <PositionBadge position={player.position} />

      {/* Name + club */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white truncate block">{player.name}</span>
        <span className="text-xs text-muted">{clubShortName}</span>
      </div>

      {/* Rating */}
      <span className={`text-sm tabular-nums font-medium w-8 text-center ${ratingColor}`}>
        {rating !== null && rating !== undefined ? rating.toFixed(1) : "-"}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1.5 min-w-[100px] justify-end">
        {performance && performance.goals > 0 && (
          <PerformanceBadge
            type="goal"
            value={`+${breakdown.goalBonus}`}
          />
        )}
        {performance && performance.assists > 0 && (
          <PerformanceBadge type="assist" />
        )}
        {performance && performance.penaltySaved > 0 && (
          <PerformanceBadge type="penaltySaved" />
        )}
        {performance && performance.ownGoals > 0 && (
          <PerformanceBadge type="ownGoal" />
        )}
        {performance && performance.redCard && (
          <PerformanceBadge type="redCard" />
        )}
      </div>

      {/* Total points */}
      <span className="text-sm font-semibold text-white tabular-nums w-10 text-right">
        {breakdown.total.toFixed(1)}
      </span>
    </div>
  );
}
