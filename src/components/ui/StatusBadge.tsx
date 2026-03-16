"use client";

import type { MatchdayStatus } from "@/lib/types";

const statusConfig: Record<MatchdayStatus, { label: string; bg: string; text: string }> = {
  PUBLISHED: { label: "Publiée", bg: "rgba(26,107,60,0.18)", text: "#4CAF7D" },
  LOCKED: { label: "Fermée", bg: "rgba(200,168,75,0.15)", text: "#C8A84B" },
  UPCOMING: { label: "A venir", bg: "rgba(107,104,96,0.2)", text: "#6B6860" },
};

export function StatusBadge({ status }: { status: MatchdayStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className="inline-flex items-center h-6 px-2.5 rounded text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}
