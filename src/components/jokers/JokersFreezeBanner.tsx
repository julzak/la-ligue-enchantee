"use client";

import { useState, useEffect } from "react";
import { Snowflake } from "lucide-react";

interface FreezeInfo {
  phase: "none" | "upcoming" | "active";
  startLabel: string | null;
  endLabel: string | null;
}

// Bannière du gel des jokers pendant le mercato d'hiver (accueil + pages
// ligue) : avertissement à partir de J-7 avant le début, puis rappel du gel
// pendant toute la fenêtre. Ne rend rien hors de ces deux phases.
export function JokersFreezeBanner() {
  const [info, setInfo] = useState<FreezeInfo | null>(null);

  useEffect(() => {
    fetch("/api/jokers/freeze")
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => {});
  }, []);

  if (!info || info.phase === "none") return null;

  const text =
    info.phase === "upcoming"
      ? `Attention : fermeture des jokers du ${info.startLabel} au ${info.endLabel} pendant le mercato d'hiver`
      : `Jokers gelés pendant le mercato d'hiver : réouverture le ${info.endLabel}`;

  return (
    <div className="bg-blue-500/10 border-b border-blue-400/20 py-2.5 px-4 text-center">
      <span className="text-sm text-blue-400 font-medium flex items-center justify-center gap-2">
        <Snowflake className="w-4 h-4 shrink-0" />
        {text}
      </span>
    </div>
  );
}
