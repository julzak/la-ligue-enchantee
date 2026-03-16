"use client";

import { CircleDot, ArrowRightCircle, ShieldCheck, XCircle, Square } from "lucide-react";

type BadgeType = "goal" | "assist" | "penaltySaved" | "ownGoal" | "redCard";

const config: Record<BadgeType, { icon: React.ElementType; color: string; label: string }> = {
  goal: { icon: CircleDot, color: "#4CAF7D", label: "" },
  assist: { icon: ArrowRightCircle, color: "#6B9FFF", label: "+1" },
  penaltySaved: { icon: ShieldCheck, color: "#C8A84B", label: "+2" },
  ownGoal: { icon: XCircle, color: "#C0392B", label: "-2" },
  redCard: { icon: Square, color: "#C0392B", label: "CR" },
};

interface PerformanceBadgeProps {
  type: BadgeType;
  value?: string;
}

export function PerformanceBadge({ type, value }: PerformanceBadgeProps) {
  const cfg = config[type];
  const Icon = cfg.icon;
  const displayValue = value ?? cfg.label;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: cfg.color }}>
      <Icon className="w-3.5 h-3.5" fill={type === "redCard" ? cfg.color : "none"} />
      {displayValue && <span>{displayValue}</span>}
    </span>
  );
}
