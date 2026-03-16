"use client";

import { Star, Trophy, Skull } from "lucide-react";
import type { TrophyType } from "@/lib/types";

const trophyConfig: Record<TrophyType, { icon: React.ElementType; color: string; glow: string }> = {
  star: { icon: Star, color: "#9CA3AF", glow: "" },
  "star-gold": { icon: Star, color: "#C8A84B", glow: "drop-shadow(0 0 2px rgba(200,168,75,0.5))" },
  cup: { icon: Trophy, color: "#C8A84B", glow: "drop-shadow(0 0 3px rgba(200,168,75,0.6))" },
  skull: { icon: Skull, color: "#C0392B", glow: "drop-shadow(0 0 2px rgba(192,57,43,0.5))" },
};

export function TrophyBadges({ trophies }: { trophies: TrophyType[] }) {
  if (trophies.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {trophies.map((t, i) => {
        const cfg = trophyConfig[t];
        const Icon = cfg.icon;
        return (
          <Icon
            key={i}
            className="w-3.5 h-3.5"
            style={{ color: cfg.color, filter: cfg.glow || undefined }}
            fill={cfg.color}
          />
        );
      })}
    </span>
  );
}
