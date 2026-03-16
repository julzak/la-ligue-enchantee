"use client";

import { SquadView } from "@/components/equipe/SquadView";
import { getSquad, getPerformances, getPlayer } from "@/lib/fixtures";
import { calculatePlayerPoints } from "@/lib/scoring";
import { Zap } from "lucide-react";

export default function MonEquipePage() {
  // Mock: show first squad participant for demo
  const squad = getSquad("tom") ?? getSquad("blek");
  if (!squad) {
    return <div className="text-muted p-8">Équipe non trouvée</div>;
  }

  const perfs = getPerformances(26);
  const starters = squad.players.filter((sp) => sp.isStarter);
  let totalJ = 0;
  let bestPlayer = { name: "", points: 0 };
  let playedCount = 0;

  starters.forEach((sp) => {
    const player = getPlayer(sp.playerId);
    if (!player) return;
    const perf = perfs.find((p) => p.playerId === sp.playerId);
    if (perf) {
      const breakdown = calculatePlayerPoints(perf, player.position);
      totalJ += breakdown.total;
      playedCount++;
      if (breakdown.total > bestPlayer.points) {
        bestPlayer = { name: player.name, points: breakdown.total };
      }
    } else {
      totalJ += 2;
    }
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="font-serif text-xl text-white mb-1">Mon équipe</h2>
        <p className="text-sm text-muted">Saison 2025-2026</p>
      </div>

      {/* Summary */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Résumé dernière journée</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-2xl font-serif font-bold text-gold">{totalJ.toFixed(1)}</span>
            <p className="text-xs text-muted mt-0.5">Score total</p>
          </div>
          <div>
            <span className="text-2xl font-serif font-bold text-white">{playedCount}/11</span>
            <p className="text-xs text-muted mt-0.5">Titu. ayant joué</p>
          </div>
          <div>
            <span className="text-lg font-medium text-white">{bestPlayer.name || "-"}</span>
            <p className="text-xs text-muted mt-0.5">Meilleur : {bestPlayer.points.toFixed(1)} pts</p>
          </div>
        </div>
      </div>

      <SquadView squad={squad} locked={false} />

      {/* Jokers */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-medium text-white">Jokers restants</h3>
        </div>
        <p className="text-sm text-muted mb-4">4 jokers saison - 2 jokers août expirés</p>
        <button className="h-9 px-4 bg-surface-2 border border-white/[0.07] rounded text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors">
          Utiliser un joker
        </button>
      </div>
    </div>
  );
}
