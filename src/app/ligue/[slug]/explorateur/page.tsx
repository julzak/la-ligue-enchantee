"use client";

import { useState } from "react";
import { clubs, players, leagues } from "@/lib/fixtures";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { PositionBadge } from "@/components/ui/PositionBadge";
import type { Player, Participant } from "@/lib/types";

// All participants across all leagues for mock ownership
const allParticipants: Participant[] = leagues.flatMap((l) => l.participants);

// Deterministic hash from string
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Deterministic mock: ~60% of players are "taken" by a participant
function getPlayerOwnership(
  player: Player
): { taken: false } | { taken: true; owner: Participant } {
  const h = hashStr(player.id);
  if (h % 10 < 6) {
    const ownerIndex = h % allParticipants.length;
    return { taken: true, owner: allParticipants[ownerIndex] };
  }
  return { taken: false };
}

// Position sort order
const posOrder = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

export default function ExplorateurPage() {
  const [openClubId, setOpenClubId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-lg text-white">
        Explorateur - Clubs Ligue 1
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clubs.map((club) => {
          const clubPlayers = players
            .filter((p) => p.clubId === club.id)
            .sort((a, b) => posOrder[a.position] - posOrder[b.position]);

          const takenCount = clubPlayers.filter(
            (p) => getPlayerOwnership(p).taken
          ).length;
          const freeCount = clubPlayers.length - takenCount;
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={club.logoUrl}
                    alt={club.name}
                    className="w-14 h-14 object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate">
                      {club.name}
                    </h3>
                    <span className="text-muted text-xs">{club.shortName}</span>
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
                      {clubPlayers.length}
                    </span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-muted">Pris</span>
                    <span className="text-gold font-semibold tabular-nums">
                      {takenCount}
                    </span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-muted">Libres</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        freeCount > 5 ? "text-vert" : "text-white/70"
                      }`}
                    >
                      {freeCount}
                    </span>
                  </div>
                </div>
              </button>

              {/* Inline drawer */}
              {isOpen && (
                <div className="bg-surface border border-t-0 border-gold/40 rounded-b-lg overflow-hidden">
                  <div className="divide-y divide-white/[0.05]">
                    {clubPlayers.map((player) => {
                      const ownership = getPlayerOwnership(player);
                      return (
                        <div
                          key={player.id}
                          className={`flex items-center gap-3 px-4 py-2.5 ${
                            ownership.taken
                              ? "bg-gold/[0.06]"
                              : "bg-transparent"
                          }`}
                        >
                          <PlayerAvatar
                            imageUrl={player.imageUrl}
                            name={player.name}
                            size={32}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {player.name}
                            </p>
                          </div>
                          <PositionBadge position={player.position} />
                          {ownership.taken ? (
                            <span className="inline-flex items-center h-6 px-2 rounded text-[10px] font-semibold bg-gold/20 text-gold whitespace-nowrap">
                              {ownership.owner.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center h-6 px-2 rounded text-[10px] font-medium bg-white/[0.05] text-muted whitespace-nowrap">
                              Libre
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {clubPlayers.length === 0 && (
                      <p className="text-muted text-sm text-center py-6">
                        Aucun joueur enregistré
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
