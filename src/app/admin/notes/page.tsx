"use client";

import { useState } from "react";
import { NotesGrid } from "@/components/admin/NotesGrid";
import { players, clubs } from "@/lib/fixtures";
import type { Performance, Position } from "@/lib/types";
import { Info } from "lucide-react";

// Mock 5 matches for J27
const mockMatches = [
  { home: "psg", away: "rcl", score: "2-1" },
  { home: "ol", away: "om", score: "1-1" },
  { home: "losc", away: "asm", score: "0-2" },
  { home: "srfc", away: "ogcn", score: "1-0" },
  { home: "fcn", away: "asse", score: "0-0" },
];

export default function AdminNotesPage() {
  const [selectedMatchday] = useState(27);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-white mb-1">Saisie des notes</h1>
          <p className="text-sm text-muted">Journée {selectedMatchday}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled
            className="h-9 px-4 bg-surface-2 border border-white/[0.07] rounded text-sm text-muted cursor-not-allowed flex items-center gap-2"
            title="Disponible en production - récupère buts/passes/cartons automatiquement"
          >
            <Info className="w-3.5 h-3.5" />
            Pre-remplir depuis API
          </button>
          <button className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 transition-colors">
            Publier la journée
          </button>
        </div>
      </div>

      {/* Match grids */}
      <div className="space-y-6">
        {mockMatches.map((match) => {
          const homeClub = clubs.find((c) => c.id === match.home);
          const awayClub = clubs.find((c) => c.id === match.away);
          const matchPlayers = players
            .filter((p) => p.clubId === match.home || p.clubId === match.away)
            .slice(0, 10) // Cap per match for readability
            .map((p) => ({
              id: p.id,
              name: p.name,
              position: p.position as Position,
              clubShortName: (p.clubId === match.home ? homeClub?.shortName : awayClub?.shortName) ?? "",
            }));

          return (
            <NotesGrid
              key={`${match.home}-${match.away}`}
              matchLabel={`${homeClub?.shortName ?? match.home} ${match.score} ${awayClub?.shortName ?? match.away}`}
              players={matchPlayers}
              initialPerformances={new Map<string, Performance>()}
            />
          );
        })}
      </div>
    </div>
  );
}
