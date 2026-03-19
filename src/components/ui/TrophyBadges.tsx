"use client";

import { Star, Trophy, Skull, Leaf, Circle } from "lucide-react";
import type { TrophyType } from "@/lib/types";

const trophyConfig: Record<TrophyType, { icon: React.ElementType; color: string; glow: string }> = {
  star: { icon: Star, color: "#6B7280", glow: "" }, // noire/gris
  "star-gold": { icon: Star, color: "#C8A84B", glow: "drop-shadow(0 0 2px rgba(200,168,75,0.5))" },
  "star-red": { icon: Star, color: "#C0392B", glow: "drop-shadow(0 0 2px rgba(192,57,43,0.5))" },
  cup: { icon: Trophy, color: "#C8A84B", glow: "drop-shadow(0 0 3px rgba(200,168,75,0.6))" },
  skull: { icon: Skull, color: "#C0392B", glow: "drop-shadow(0 0 2px rgba(192,57,43,0.5))" },
  leaf: { icon: Leaf, color: "#1A6B3C", glow: "drop-shadow(0 0 2px rgba(26,107,60,0.5))" },
  "ballon-dor": { icon: Circle, color: "#C8A84B", glow: "drop-shadow(0 0 3px rgba(200,168,75,0.8))" },
};

export function TrophyBadges({ trophies }: { trophies: TrophyType[] }) {
  if (trophies.length === 0) return null;

  // Group consecutive same trophies for compact display (e.g., ★x4)
  const grouped: { type: TrophyType; count: number }[] = [];
  for (const t of trophies) {
    const last = grouped[grouped.length - 1];
    if (last && last.type === t) {
      last.count++;
    } else {
      grouped.push({ type: t, count: 1 });
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {grouped.map((g, i) => {
        const cfg = trophyConfig[g.type];
        const Icon = cfg.icon;
        if (g.count > 2) {
          // Compact: icon + xN
          return (
            <span key={i} className="inline-flex items-center">
              <Icon
                className="w-3.5 h-3.5"
                style={{ color: cfg.color, filter: cfg.glow || undefined }}
                fill={cfg.color}
              />
              <span className="text-[8px] text-muted" style={{ color: cfg.color }}>x{g.count}</span>
            </span>
          );
        }
        // Normal: repeat icon
        return Array.from({ length: g.count }, (_, j) => (
          <Icon
            key={`${i}-${j}`}
            className="w-3.5 h-3.5"
            style={{ color: cfg.color, filter: cfg.glow || undefined }}
            fill={cfg.color}
          />
        ));
      })}
    </span>
  );
}
