"use client";

import { ChevronUp, ChevronDown, Minus } from "lucide-react";

export function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-vert text-sm font-medium">
        <ChevronUp className="w-4 h-4" />
        <span>+{delta}</span>
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-rouge text-sm font-medium">
        <ChevronDown className="w-4 h-4" />
        <span>{delta}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
      <Minus className="w-4 h-4" />
    </span>
  );
}
