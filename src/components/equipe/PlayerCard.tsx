"use client";

import type { Player, FormIndicator } from "@/lib/types";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { FormBadge } from "@/components/ui/FormBadge";

interface PlayerCardProps {
  player: Player;
  clubShortName: string;
  clubLogoUrl?: string;
  avgRating?: number;
  form?: FormIndicator;
  isStarter: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

export function PlayerCard({
  player,
  clubShortName,
  clubLogoUrl,
  avgRating,
  form,
  isStarter,
  onToggle,
  disabled,
}: PlayerCardProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left ${
        isStarter
          ? "bg-gold/[0.06] border-2 border-gold/25 shadow-[inset_0_0_20px_rgba(200,168,75,0.03)]"
          : "bg-surface-2 border border-white/[0.07]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/[0.04] cursor-pointer active:scale-[0.98]"}`}
    >
      {/* Player photo */}
      <PlayerAvatar imageUrl={player.imageUrl} name={player.name} size={44} />

      {/* Info block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PositionBadge position={player.position} />
          <span className="text-sm font-medium text-white">{player.name}</span>
          <FormBadge form={form ?? null} />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {clubLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clubLogoUrl} alt={clubShortName} className="w-3.5 h-3.5 object-contain" />
          )}
          <span className="text-xs text-muted">{clubShortName}</span>
          {avgRating !== undefined && (
            <span className={`text-xs tabular-nums font-medium ml-auto ${avgRating >= 6.5 ? "text-gold" : avgRating < 5 ? "text-rouge" : "text-white/50"}`}>
              {avgRating.toFixed(1)} moy.
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
