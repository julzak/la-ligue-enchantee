"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  getLeague,
  getLeagueStandings,
  getParticipant,
  currentMatchday,
} from "@/lib/fixtures";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { DeltaBadge } from "@/components/ui/DeltaBadge";

// Deterministic mock matchday results based on participant ID + journée
function getMockMatchdayResult(participantId: string, journee: number) {
  const hash = (participantId + journee).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const jrsUtil = 9 + (hash % 3); // 9-11
  const passes = (hash % 4);
  const buts = (hash % 3);
  const noteFF = Math.round((40 + (hash % 30)) * 10) / 100; // 4.0 - 7.0
  const ptsG = Math.round((3 + (hash % 8)) * 10) / 10;
  const ptsD = Math.round((5 + (hash % 12)) * 10) / 10;
  const ptsM = Math.round((6 + (hash % 15)) * 10) / 10;
  const ptsA = Math.round((4 + (hash % 10)) * 10) / 10;
  const total = Math.round((ptsG + ptsD + ptsM + ptsA) * 10) / 10;
  const ptsJoueur = Math.round((total / jrsUtil) * 100) / 100;
  const delta = (hash % 7) - 3; // -3 to +3
  return { jrsUtil, passes, buts, noteFF, ptsG, ptsD, ptsM, ptsA, total, ptsJoueur, delta };
}

// Mock highlight data for the journée
function getMockHighlights(rows: { participantName: string; total: number; delta: number; buts: number; passes: number }[]) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const bestReason = best.buts >= 2
    ? `+${Math.abs(best.delta)} places grâce au doublé de son attaquant`
    : best.passes >= 2
      ? `Meilleur passeur de la journée avec ${best.passes} passes décisives`
      : `${best.total.toFixed(1)} pts — la meilleure performance de la journée`;

  const worstReason = worst.buts === 0 && worst.passes === 0
    ? `Aucun but, aucune passe — une journée à oublier`
    : `Seulement ${worst.total.toFixed(1)} pts — le banc a fait le minimum`;

  return {
    best: { name: best.participantName, reason: bestReason, total: best.total },
    worst: { name: worst.participantName, reason: worstReason, total: worst.total },
  };
}

export default function ResultatsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const league = getLeague(slug);
  const standings = getLeagueStandings(slug);
  const [selectedJournee, setSelectedJournee] = useState(currentMatchday);

  if (!league || !standings) {
    return <div className="text-muted p-8">Ligue non trouvée</div>;
  }

  // Generate matchday results and sort by total points descending
  const rows = standings.standings
    .map((s) => {
      const mock = getMockMatchdayResult(s.participantId, selectedJournee);
      return {
        participantId: s.participantId,
        participantName: s.participantName,
        seasonRank: s.rank,
        ...mock,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((row, i) => ({ ...row, matchdayRank: i + 1 }));

  const highlights = getMockHighlights(rows);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="font-serif text-lg text-white">
          Résultats de la journée {selectedJournee}
        </h2>
        <select
          value={selectedJournee}
          onChange={(e) => setSelectedJournee(Number(e.target.value))}
          className="bg-surface-2 border border-white/[0.07] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gold w-fit"
        >
          {Array.from({ length: currentMatchday }, (_, i) => i + 1).map((j) => (
            <option key={j} value={j}>Journée {j}</option>
          ))}
        </select>
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* L'exploit de la journée */}
        <div className="bg-surface rounded-lg border-l-4 border-vert border border-white/[0.07] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-vert text-xs font-semibold uppercase tracking-wider">L&apos;exploit de la journée</span>
          </div>
          <p className="text-white font-semibold text-sm">{highlights.best.name}</p>
          <p className="text-muted text-xs mt-1">{highlights.best.reason}</p>
          <p className="text-vert text-xs font-bold mt-2 tabular-nums">{highlights.best.total.toFixed(1)} pts</p>
        </div>

        {/* La saucisse de la journée */}
        <div className="bg-surface rounded-lg border-l-4 border-rouge border border-white/[0.07] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-rouge text-xs font-semibold uppercase tracking-wider">La saucisse de la journée 🌭</span>
          </div>
          <p className="text-white font-semibold text-sm">{highlights.worst.name}</p>
          <p className="text-muted text-xs mt-1">{highlights.worst.reason}</p>
          <p className="text-rouge text-xs font-bold mt-2 tabular-nums">{highlights.worst.total.toFixed(1)} pts</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-lg border border-white/[0.07] overflow-x-auto">
        <div className="min-w-[950px]">
          {/* Header row */}
          <div className="grid grid-cols-[2.5rem_minmax(10rem,1fr)_3rem_4rem_2.5rem_3rem_3rem_3rem_3.5rem_3.5rem_3.5rem_3.5rem_3.5rem_3.5rem] px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07] bg-surface-2">
            <span className="text-center">Pos</span>
            <span>Ligueur</span>
            <span className="text-center">Cl.</span>
            <span className="text-center">Total</span>
            <span className="text-center"></span>
            <span className="text-center">Jrs</span>
            <span className="text-center">Pas.</span>
            <span className="text-center">Buts</span>
            <span className="text-center">Note</span>
            <span className="text-center">Pts G</span>
            <span className="text-center">Pts D</span>
            <span className="text-center">Pts M</span>
            <span className="text-center">Pts A</span>
            <span className="text-center">Pts/j</span>
          </div>

          {/* Data rows */}
          {rows.map((row, i) => {
            const participant = getParticipant(row.participantId);
            const isFirst = row.matchdayRank === 1;
            const isLast = row.matchdayRank === rows.length;

            return (
              <div
                key={row.participantId}
                className={`grid grid-cols-[2.5rem_minmax(10rem,1fr)_3rem_4rem_2.5rem_3rem_3rem_3rem_3.5rem_3.5rem_3.5rem_3.5rem_3.5rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] ${
                  isFirst ? "bg-gold/[0.04]" : isLast ? "bg-rouge/[0.04]" : i % 2 === 1 ? "bg-white/[0.01]" : ""
                }`}
              >
                <span className={`text-center font-medium ${row.matchdayRank <= 3 ? "text-gold" : "text-muted"}`}>
                  {row.matchdayRank}
                </span>
                <Link
                  href={`/ligue/${slug}/equipe/${row.participantId}`}
                  className="text-white hover:text-gold transition-colors truncate flex items-center gap-1"
                >
                  {row.participantName}
                  {participant && <TrophyBadges trophies={participant.trophies} />}
                </Link>
                <span className="text-center tabular-nums text-muted">{row.seasonRank}</span>
                <span className="text-center tabular-nums font-semibold text-white">{row.total.toFixed(1)}</span>
                <span className="text-center">
                  <DeltaBadge delta={row.delta} />
                </span>
                <span className="text-center tabular-nums text-white/70">{row.jrsUtil}</span>
                <span className={`text-center tabular-nums ${row.passes > 0 ? "text-gold font-medium" : "text-white/70"}`}>{row.passes}</span>
                <span className={`text-center tabular-nums ${row.buts > 0 ? "text-vert font-medium" : "text-white/70"}`}>{row.buts}</span>
                <span className="text-center tabular-nums text-white/70">{row.noteFF.toFixed(1)}</span>
                <span className="text-center tabular-nums text-white/70">{row.ptsG.toFixed(1)}</span>
                <span className="text-center tabular-nums text-white/70">{row.ptsD.toFixed(1)}</span>
                <span className="text-center tabular-nums text-white/70">{row.ptsM.toFixed(1)}</span>
                <span className="text-center tabular-nums text-white/70">{row.ptsA.toFixed(1)}</span>
                <span className="text-center tabular-nums text-muted">{row.ptsJoueur.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom link */}
      <div className="flex justify-end">
        <Link href={`/ligue/${slug}/classement-general`} className="text-sm text-gold hover:underline">
          Classement général &rarr;
        </Link>
      </div>
    </div>
  );
}
