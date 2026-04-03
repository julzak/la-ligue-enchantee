"use client";

import { Star, Trophy, Skull, Leaf } from "lucide-react";
import type { TrophyType } from "@/lib/types";

function BallonDor({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="currentColor" strokeWidth="1" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#1C1C1C" strokeWidth="0.8" opacity="0.3" />
      <line x1="12" y1="2" x2="12" y2="22" stroke="#1C1C1C" strokeWidth="0.5" opacity="0.2" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="#1C1C1C" strokeWidth="0.5" opacity="0.2" />
    </svg>
  );
}

const trophyConfig: Record<TrophyType, { icon: React.ElementType; color: string }> = {
  star: { icon: Star, color: "#8B6914" },
  "star-gold": { icon: Star, color: "#C8A84B" },
  "star-red": { icon: Star, color: "#C0392B" },
  cup: { icon: Trophy, color: "#C8A84B" },
  skull: { icon: Skull, color: "#C0392B" },
  leaf: { icon: Leaf, color: "#E07A5F" },
  "ballon-dor": { icon: BallonDor, color: "#C8A84B" },
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
    <span className="inline-flex items-center gap-0.5 ml-1 shrink-0">
      {grouped.map((g, i) => {
        const cfg = trophyConfig[g.type];
        const Icon = cfg.icon;
        const color = getColor(g.type);
        return (
          <span key={i} className="inline-flex items-center">
            <Icon className="w-3.5 h-3.5" style={{ color }} fill={color} />
            {g.count > 1 && (
              <span className="text-[9px] font-bold leading-none" style={{ color }}>
                {g.count}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
