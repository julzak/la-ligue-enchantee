"use client";

import { useParams } from "next/navigation";
import { cupMatches, getLeague } from "@/lib/fixtures";

export default function CoupePage() {
  const params = useParams();
  const slug = params.slug as string;
  const league = getLeague(slug);

  const rounds = ["Quarts de finale", "Demi-finales", "Finale"];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="font-serif text-xl text-white mb-1">Coupe</h2>
        <p className="text-sm text-muted">Saison 2025-2026</p>
      </div>

      {rounds.map((round) => {
        const matches = cupMatches.filter((m) => m.round === round);
        return (
          <div key={round}>
            <h3 className="font-serif text-lg text-white mb-3">{round}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {matches.map((match, i) => {
                const p1 = league?.participants.find((p) => p.id === match.participant1Id);
                const p2 = league?.participants.find((p) => p.id === match.participant2Id);
                const hasResult = match.score1 !== null;

                return (
                  <div
                    key={i}
                    className="bg-surface rounded-lg border border-white/[0.07] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {p1?.name || "TBD"}
                      </span>
                      {hasResult ? (
                        <span className="text-sm font-serif font-bold text-gold tabular-nums">
                          {match.score1} - {match.score2}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">J{match.matchday}</span>
                      )}
                      <span className="text-sm font-medium text-white">
                        {p2?.name || "TBD"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
