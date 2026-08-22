"use client";

import { useCountdown } from "@/components/ui/CountdownTimer";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { useParams } from "next/navigation";

interface LockCountdownProps {
  matchdayNumber: number;
  lockAt: Date;
  isLocked: boolean;
  // Deadlines de chaque date de match de la journée (triées). Une journée
  // étalée sur plusieurs jours ne se ferme qu'à la dernière : entre deux, le
  // bandeau annonce la prochaine fermeture au lieu de « journée fermée »
  // (remontée Pierre J1 2026-2027 : 8 matchs encore ouverts).
  lockDates?: Date[];
}

export function LockCountdown({ matchdayNumber, lockAt, isLocked, lockDates }: LockCountdownProps) {
  const dates = lockDates && lockDates.length > 0 ? lockDates : [lockAt];
  const now = Date.now();
  const upcoming = dates.filter((d) => d.getTime() > now);
  const target = upcoming[0] ?? dates[dates.length - 1];
  const partial = upcoming.length > 0 && upcoming.length < dates.length;
  const { formatted, isUrgent, isExpired } = useCountdown(target);
  const params = useParams();
  const slug = params.slug as string | undefined;

  if (isLocked || (isExpired && upcoming.length === 0)) {
    return (
      <div className="bg-surface-2 border-b border-white/[0.07] py-2.5 px-4 text-center text-sm text-muted">
        Journée {matchdayNumber} fermée - en attente des résultats
      </div>
    );
  }

  const lockDateStr = format(target, "EEEE HH'h'mm", { locale: fr });

  return (
    <div
      className={`border-b border-white/[0.07] py-2.5 px-4 transition-colors ${
        isUrgent ? "bg-rouge/20" : "bg-surface-2"
      }`}
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <span className={`text-sm ${isUrgent ? "text-white" : "text-white/70"}`}>
          {partial
            ? `J${matchdayNumber} en cours - clubs déjà joués bloqués - prochaine fermeture ${lockDateStr} - dans `
            : `J${matchdayNumber} - fermeture ${lockDateStr} - dans `}
          <span className={`font-bold tabular-nums ${isUrgent ? "text-white" : "text-gold"}`}>
            {formatted}
          </span>
        </span>
        {slug && (
          <Link
            href={`/ligue/${slug}/mon-equipe`}
            className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
              isUrgent
                ? "bg-white text-rouge hover:bg-white/90"
                : "bg-gold text-night hover:bg-gold/90"
            }`}
          >
            Faire mon équipe
          </Link>
        )}
      </div>
    </div>
  );
}
