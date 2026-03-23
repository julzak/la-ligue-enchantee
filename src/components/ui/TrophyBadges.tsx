"use client";

import { Star, Trophy, Skull, Leaf, Circle } from "lucide-react";
import type { TrophyType } from "@/lib/types";

const trophyConfig: Record<TrophyType, { icon: React.ElementType; color: string }> = {
  star: { icon: Star, color: "#8B6914" },
  "star-gold": { icon: Star, color: "#C8A84B" },
  "star-red": { icon: Star, color: "#C0392B" },
  cup: { icon: Trophy, color: "#C8A84B" },
  skull: { icon: Skull, color: "#C0392B" },
  leaf: { icon: Leaf, color: "#1A6B3C" },
  "ballon-dor": { icon: Circle, color: "#C8A84B" },
};

// leagueSlug: "ligue-1" = gold stars, others = grey stars
export function TrophyBadges({ trophies, leagueSlug }: { trophies: TrophyType[]; leagueSlug?: string }) {
  if (trophies.length === 0) return null;

  const isL1 = !leagueSlug || leagueSlug === "ligue-1";

  // Group consecutive same trophies
  const grouped: { type: TrophyType; count: number }[] = [];
  for (const t of trophies) {
    const last = grouped[grouped.length - 1];
    if (last && last.type === t) last.count++;
    else grouped.push({ type: t, count: 1 });
  }

  function getColor(type: TrophyType): string {
    // Star-gold: gold for L1, grey for others
    if (type === "star-gold" && !isL1) return "#9CA3AF";
    return trophyConfig[type].color;
  }

  return (
    <span className="inline-flex items-center gap-px ml-1 shrink-0">
      {grouped.map((g, i) => {
        const cfg = trophyConfig[g.type];
        const Icon = cfg.icon;
        const color = getColor(g.type);
        return (
          <span key={i} className="inline-flex items-center">
            <Icon className="w-3 h-3" style={{ color }} fill={color} />
            {g.count > 1 && (
              <span className="text-[7px] leading-none" style={{ color }}>
                {g.count}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
