import Image from "next/image";
import type { MatchPlayerRating } from "@/lib/db";

function ratingColor(rating: number | null): string {
  if (rating === null) return "text-muted";
  if (rating >= 7) return "text-gold";
  if (rating >= 6) return "text-vert";
  if (rating >= 5) return "text-white/70";
  return "text-rouge";
}

interface MatchCardProps {
  homeClub: string;
  awayClub: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number;
  awayScore: number;
  homeRatings: MatchPlayerRating[];
  awayRatings: MatchPlayerRating[];
}

function PlayerRatingRow({ p }: { p: MatchPlayerRating }) {
  return (
    <div className="flex items-center gap-1.5 py-[3px]">
      <span className="text-[10px] text-muted w-6 uppercase">{p.position}</span>
      <span className="text-xs text-white/80 flex-1 truncate">
        {p.playerName.split(" ").pop()}
        {p.goals > 0 && (
          <span className="text-gold ml-1">
            {"⚽".repeat(p.goals)}
          </span>
        )}
        {p.passes > 0 && (
          <span className="text-vert ml-1">
            {"🅰️".repeat(p.passes)}
          </span>
        )}
        {p.redCard && (
          <span className="ml-1">🟥</span>
        )}
      </span>
      <span
        className={`text-xs font-bold tabular-nums w-7 text-right ${ratingColor(p.rating)}`}
      >
        {p.rating !== null ? p.rating.toFixed(1) : "-"}
      </span>
    </div>
  );
}

export function MatchCard({
  homeClub,
  awayClub,
  homeLogo,
  awayLogo,
  homeScore,
  awayScore,
  homeRatings,
  awayRatings,
}: MatchCardProps) {
  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      {/* Score header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {homeLogo && (
            <Image src={homeLogo} alt={homeClub} width={24} height={24} className="shrink-0" />
          )}
          <span className="text-sm font-medium text-white truncate">{homeClub}</span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-1.5 px-3">
          <span className={`text-xl font-serif font-bold tabular-nums ${homeScore > awayScore ? "text-gold" : "text-white/60"}`}>
            {homeScore}
          </span>
          <span className="text-xs text-muted">-</span>
          <span className={`text-xl font-serif font-bold tabular-nums ${awayScore > homeScore ? "text-gold" : "text-white/60"}`}>
            {awayScore}
          </span>
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-sm font-medium text-white truncate text-right">{awayClub}</span>
          {awayLogo && (
            <Image src={awayLogo} alt={awayClub} width={24} height={24} className="shrink-0" />
          )}
        </div>
      </div>

      {/* Player ratings */}
      {(homeRatings.length > 0 || awayRatings.length > 0) && (
        <div className="grid grid-cols-2 gap-0 divide-x divide-white/[0.05]">
          {/* Home players */}
          <div className="px-3 py-2">
            {homeRatings.map((p) => (
              <PlayerRatingRow key={p.playerId} p={p} />
            ))}
          </div>
          {/* Away players */}
          <div className="px-3 py-2">
            {awayRatings.map((p) => (
              <PlayerRatingRow key={p.playerId} p={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
