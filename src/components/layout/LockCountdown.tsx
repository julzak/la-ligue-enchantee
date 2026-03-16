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
}

export function LockCountdown({ matchdayNumber, lockAt, isLocked }: LockCountdownProps) {
  const { formatted, isUrgent, isExpired } = useCountdown(lockAt);
  const params = useParams();
  const slug = params.slug as string | undefined;

  if (isLocked || isExpired) {
    return (
      <div className="bg-surface-2 border-b border-white/[0.07] py-2.5 px-4 text-center text-sm text-muted">
        Journée {matchdayNumber} fermée - résultats en cours de saisie
      </div>
    );
  }

  const lockDateStr = format(lockAt, "EEEE HH'h'mm", { locale: fr });

  return (
    <div
      className={`border-b border-white/[0.07] py-2.5 px-4 transition-colors ${
        isUrgent ? "bg-rouge/20" : "bg-surface-2"
      }`}
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <span className={`text-sm ${isUrgent ? "text-white" : "text-white/70"}`}>
          J{matchdayNumber} - fermeture {lockDateStr} - dans{" "}
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
