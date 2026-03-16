"use client";

import { useState } from "react";
import type { Squad, Position, FormIndicator } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";
import { getPlayer, getClub, getPerformances } from "@/lib/fixtures";

interface SquadViewProps {
  squad: Squad;
  locked: boolean;
}

const positionOrder: Position[] = ["GK", "DEF", "MID", "ATT"];
const positionLabels: Record<Position, string> = {
  GK: "Gardien",
  DEF: "Defenseurs",
  MID: "Milieux",
  ATT: "Attaquants",
};

function getPlayerForm(playerId: string): FormIndicator {
  const perfs = getPerformances(26);
  const perf = perfs.find((p) => p.playerId === playerId);
  if (!perf || perf.rating === null) return null;
  if (perf.rating >= 7) return "hot";
  if (perf.rating <= 4) return "cold";
  return null;
}

export function SquadView({ squad, locked }: SquadViewProps) {
  const [localSquad, setLocalSquad] = useState(squad);

  const starters = localSquad.players.filter((sp) => sp.isStarter);
  const bench = localSquad.players.filter((sp) => !sp.isStarter);
  const starterCount = starters.length;
  const isValid = starterCount === 11;

  function handleToggle(playerId: string) {
    if (locked) return;
    setLocalSquad((prev) => ({
      ...prev,
      players: prev.players.map((sp) =>
        sp.playerId === playerId ? { ...sp, isStarter: !sp.isStarter } : sp
      ),
    }));
  }

  function renderPlayer(playerId: string, isStarter: boolean) {
    const player = getPlayer(playerId);
    if (!player) return null;
    const club = getClub(player.clubId);
    const form = getPlayerForm(playerId);

    return (
      <PlayerCard
        key={playerId}
        player={player}
        clubShortName={club?.shortName ?? ""}
        clubLogoUrl={club?.logoUrl}
        form={form}
        avgRating={5.5 + Math.random() * 1.5} // mock avg
        isStarter={isStarter}
        onToggle={() => handleToggle(playerId)}
        disabled={locked}
      />
    );
  }

  // Group starters by position
  const grouped = positionOrder.map((pos) => ({
    position: pos,
    label: positionLabels[pos],
    players: starters
      .filter((sp) => {
        const p = getPlayer(sp.playerId);
        return p && p.position === pos;
      }),
  }));

  return (
    <div className="space-y-6">
      {locked && (
        <div className="bg-rouge/10 border border-rouge/20 rounded-lg px-4 py-3 text-sm text-rouge text-center font-medium">
          La journée est fermée. Vous ne pouvez plus modifier votre composition.
        </div>
      )}

      {/* Formation by position groups */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm uppercase tracking-wider text-muted">Titulaires ({starterCount}/11)</h3>
          {!isValid && (
            <span className="text-xs text-rouge font-medium">Sélectionnez exactement 11 titulaires</span>
          )}
        </div>
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.position}>
              <p className="text-[10px] uppercase tracking-widest text-muted mb-2 pl-1">{group.label}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.players.map((sp) => renderPlayer(sp.playerId, true))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bench */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted mb-4">Banc ({bench.length})</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {bench.map((sp) => renderPlayer(sp.playerId, false))}
        </div>
      </div>

      {/* Validate */}
      {!locked && (
        <button
          disabled={!isValid}
          className={`w-full h-12 rounded-lg font-semibold text-sm transition-all ${
            isValid
              ? "bg-gold text-night hover:bg-gold/90 active:scale-[0.99]"
              : "bg-muted/20 text-muted cursor-not-allowed"
          }`}
        >
          Valider mon équipe
        </button>
      )}
    </div>
  );
}
