"use client";

import type { Position } from "@/lib/types";

const positionStyles: Record<Position, { bg: string; text: string }> = {
  GK: { bg: "rgba(200,168,75,0.15)", text: "#C8A84B" },
  DEF: { bg: "rgba(26,107,60,0.18)", text: "#4CAF7D" },
  MID: { bg: "rgba(107,159,255,0.15)", text: "#6B9FFF" },
  ATT: { bg: "rgba(192,57,43,0.18)", text: "#E57368" },
};

export function PositionBadge({ position }: { position: Position }) {
  const style = positionStyles[position];
  return (
    <span
      className="inline-flex items-center justify-center h-6 px-2 rounded text-[9px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {position}
    </span>
  );
}
