"use client";

import { Crown, Skull } from "lucide-react";

interface RankBadgeProps {
  rank: number;
  total: number;
}

export function RankBadge({ rank, total }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-gold" title="Leader">
        <Crown className="w-4 h-4" fill="#C8A84B" />
      </span>
    );
  }
  if (rank === total) {
    return (
      <span className="inline-flex items-center gap-1" title="Lanterne rouge">
        <Skull className="w-3.5 h-3.5 text-rouge" />
      </span>
    );
  }
  return null;
}
