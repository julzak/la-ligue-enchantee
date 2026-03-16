"use client";

import { useState } from "react";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { PositionBadge } from "@/components/ui/PositionBadge";
import type { Position } from "@/lib/types";

interface ClubPlayer {
  id: number;
  name: string;
  position: Position;
  owner: string | null;
}

interface ClubWithStats {
  id: number;
  name: string;
  effectif: number;
  taken: number;
  free: number;
  players: ClubPlayer[];
}

const posOrder: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

export function ExplorateurContent({ clubs }: { clubs: ClubWithStats[] }) {
  const [openClubId, setOpenClubId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-lg text-white">
        Explorateur - Clubs Ligue 1
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clubs.map((club) => {
          const sortedPlayers = [...club.players].sort(
            (a, b) => posOrder[a.position] - posOrder[b.position]
          );
          const isOpen = openClubId === club.id;

          return (
            <div key={club.id} className="flex flex-col">
              {/* Card */}
              <button
                onClick={() => setOpenClubId(isOpen ? null : club.id)}
                className={`bg-surface rounded-lg border p-5 text-left transition-colors w-full ${
                  isOpen
                    ? "border-gold/40 rounded-b-none"
                    : "border-white/[0.07] hover:border-gold/30"
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-lg bg-surface-2 border border-white/[0.07] flex items-center justify-center shrink-0">
                    <span className="text-muted text-xs font-medium">
                      {club.name.slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate">
                      {club.name}
                    </h3>
                  </div>
                  <svg
                    className={`w-4 h-4 text-muted transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                <div className="flex gap-4 text-xs">
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-muted">Effectif</span>
                    <span className="text-white font-semibold tabular-nums">
                      {club.effectif}
                    </span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-muted">Pris</span>
                    <span className="text-gold font-semibold tabular-nums">
                      {club.taken}
                    </span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-muted">Libres</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        club.free > 5 ? "text-vert" : "text-white/70"
                      }`}
                    >
                      {club.free}
                    </span>
                  </div>
                </div>
              </button>

              {/* Inline drawer */}
              {isOpen && (
                <div className="bg-surface border border-t-0 border-gold/40 rounded-b-lg overflow-hidden">
                  <div className="divide-y divide-white/[0.05]">
                    {sortedPlayers.map((player) => (
                      <div
                        key={player.id}
                        className={`flex items-center gap-3 px-4 py-2.5 ${
                          player.owner ? "bg-gold/[0.06]" : "bg-transparent"
                        }`}
                      >
                        <PlayerAvatar name={player.name} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {player.name}
                          </p>
                        </div>
                        <PositionBadge position={player.position} />
                        {player.owner ? (
                          <span className="inline-flex items-center h-6 px-2 rounded text-[10px] font-semibold bg-gold/20 text-gold whitespace-nowrap">
                            {player.owner}
                          </span>
                        ) : (
                          <span className="inline-flex items-center h-6 px-2 rounded text-[10px] font-medium bg-white/[0.05] text-muted whitespace-nowrap">
                            Libre
                          </span>
                        )}
                      </div>
                    ))}
                    {club.players.length === 0 && (
                      <p className="text-muted text-sm text-center py-6">
                        Aucun joueur enregistre
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
