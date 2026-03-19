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

export function TrophyBadges({ trophies }: { trophies: TrophyType[] }) {
  if (trophies.length === 0) return null;

  // Group consecutive same trophies
  const grouped: { type: TrophyType; count: number }[] = [];
  for (const t of trophies) {
    const last = grouped[grouped.length - 1];
    if (last && last.type === t) last.count++;
    else grouped.push({ type: t, count: 1 });
  }

  return (
    <span className="inline-flex items-center gap-px ml-1 shrink-0">
      {grouped.map((g, i) => {
        const cfg = trophyConfig[g.type];
        const Icon = cfg.icon;
        return (
          <span key={i} className="inline-flex items-center">
            <Icon className="w-3 h-3" style={{ color: cfg.color }} fill={cfg.color} />
            {g.count > 1 && (
              <span className="text-[7px] leading-none" style={{ color: cfg.color }}>
                {g.count}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
