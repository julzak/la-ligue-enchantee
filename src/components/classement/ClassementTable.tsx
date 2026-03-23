"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { Standing } from "@/lib/types";
import type { Participant } from "@/lib/types";
import { DeltaBadge } from "@/components/ui/DeltaBadge";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { RankBadge } from "@/components/ui/RankBadge";

interface ClassementTableProps {
  standings: Standing[];
  participants: Participant[];
}

export function ClassementTable({ standings, participants }: ClassementTableProps) {
  const total = standings.length;
  const params = useParams();
  const slug = params.slug as string;

  function getParticipant(id: string): Participant | undefined {
    return participants.find((p) => p.id === id);
  }

  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07]">
        <h2 className="font-serif text-sm text-paper">Classement de la journée</h2>
      </div>

      <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem] px-3 py-2 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07]">
        <span></span>
        <span>Ligueur</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Pts/jrs</span>
      </div>

      {standings.map((s) => {
        const participant = getParticipant(s.participantId);
        const isFirst = s.rank === 1;
        const isLast = s.rank === total;

        return (
          <Link
            key={s.participantId}
            href={`/ligue/${slug}/equipe/${s.participantId}`}
            className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem] items-center px-3 py-2 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.04] transition-colors ${
              isFirst ? "bg-gold/[0.04]" : isLast ? "bg-rouge/[0.04]" : ""
            }`}
          >
            <span className={`text-sm font-medium ${s.rank <= 3 ? "text-gold" : "text-muted"}`}>
              {s.rank}
            </span>
            <span className="text-sm text-white truncate flex items-center gap-1 hover:text-gold transition-colors">
              <RankBadge rank={s.rank} total={total} />
              {s.participantName}
              {participant && <TrophyBadges trophies={participant.trophies} leagueSlug={slug} />}
              {s.delta !== 0 && (
                <span className="ml-0.5"><DeltaBadge delta={s.delta} /></span>
              )}
            </span>
            <span className="text-sm text-right text-white font-medium tabular-nums">
              {s.lastMatchdayPoints.toFixed(1)}
            </span>
            <span className="text-sm text-right text-muted tabular-nums">
              {s.ptsPerDay.toFixed(2)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
