"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  getLeague,
  getLeagueStandings,
  getParticipant,
  currentMatchday,
} from "@/lib/fixtures";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { DeltaBadge } from "@/components/ui/DeltaBadge";
import { RankBadge } from "@/components/ui/RankBadge";

// Deterministic mock data based on participant ID hash
function getMockGeneralData(participantId: string, rank: number) {
  const hash = participantId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const passes = 8 + (hash % 15);
  const buts = 3 + (hash % 12);
  const note = 90 + (hash % 60);
  const ptsG = 30 + (hash % 25);
  const ptsD = 45 + (hash % 35);
  const ptsM = 55 + (hash % 40);
  const ptsA = 40 + (hash % 30);
  const prime = 5 + (hash % 20);
  const total = ptsG + ptsD + ptsM + ptsA + prime;
  const moyJoueur = Math.round((total / (11 * currentMatchday)) * 100) / 100;
  const delta = rank <= 3 ? (hash % 3) : rank > 15 ? -(hash % 3) : ((hash % 5) - 2);
  return { passes, buts, note: note / 10, ptsG, ptsD, ptsM, ptsA, prime, total, moyJoueur, delta };
}

export default function ClassementGeneralPage() {
  const params = useParams();
  const slug = params.slug as string;
  const league = getLeague(slug);
  const standings = getLeagueStandings(slug);
  const [selectedJournee, setSelectedJournee] = useState(currentMatchday);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (!league || !standings) {
    return <div className="text-muted p-8">Ligue non trouvée</div>;
  }

  const rows = standings.standings.map((s) => {
    const mock = getMockGeneralData(s.participantId, s.rank);
    return {
      ...s,
      ...mock,
      total: s.totalPoints,
    };
  });

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function podiumBg(rank: number): string {
    if (rank === 1) return "bg-[#C8A84B]/[0.08] border-l-2 border-l-[#C8A84B]/40";
    if (rank === 2) return "bg-[#A0A0A0]/[0.06] border-l-2 border-l-[#A0A0A0]/30";
    if (rank === 3) return "bg-[#CD7F32]/[0.06] border-l-2 border-l-[#CD7F32]/30";
    return "";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="font-serif text-lg text-white">
          Classement général — Saison {currentMatchday > 0 ? "2025-2026" : ""}
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

      {/* Table */}
      <div className="bg-surface rounded-lg border border-white/[0.07] overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Header row */}
          <div className="grid grid-cols-[2.5rem_minmax(10rem,1fr)_4.5rem_2.5rem_3.5rem_3.5rem_4rem_2rem] px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07] bg-surface-2">
            <span className="text-center">Pos</span>
            <span>Ligueur</span>
            <span className="text-center">Total</span>
            <span className="text-center"></span>
            <span className="text-center">Buts</span>
            <span className="text-center">Pas.</span>
            <span className="text-center">Moy/j</span>
            <span></span>
          </div>

          {/* Data rows */}
          {rows.map((row, i) => {
            const participant = getParticipant(row.participantId);
            const isExpanded = expandedRows.has(row.participantId);
            const isPodium = row.rank <= 3;
            const isLast = row.rank === standings.standings.length;

            return (
              <div key={row.participantId}>
                {/* Main row */}
                <div
                  onClick={() => toggleRow(row.participantId)}
                  className={`grid grid-cols-[2.5rem_minmax(10rem,1fr)_4.5rem_2.5rem_3.5rem_3.5rem_4rem_2rem] items-center px-3 py-2.5 border-b border-white/[0.05] cursor-pointer hover:bg-white/[0.03] transition-colors ${
                    isPodium
                      ? podiumBg(row.rank)
                      : isLast
                        ? "bg-rouge/[0.04]"
                        : i % 2 === 1
                          ? "bg-white/[0.01]"
                          : ""
                  } ${isPodium ? "text-[15px]" : "text-sm"}`}
                >
                  <span className={`text-center font-semibold ${row.rank === 1 ? "text-[#C8A84B]" : row.rank === 2 ? "text-[#A0A0A0]" : row.rank === 3 ? "text-[#CD7F32]" : "text-muted"}`}>
                    {row.rank}
                  </span>
                  <Link
                    href={`/ligue/${slug}/equipe/${row.participantId}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-white hover:text-gold transition-colors truncate flex items-center gap-1.5 ${isPodium ? "font-semibold" : ""}`}
                  >
                    {row.participantName}
                    {participant && <TrophyBadges trophies={participant.trophies} />}
                    <RankBadge rank={row.rank} total={standings.standings.length} />
                  </Link>
                  <span className={`text-center tabular-nums font-bold ${isPodium ? "text-white" : "text-white"}`}>
                    {row.total.toFixed(1)}
                  </span>
                  <span className="text-center">
                    <DeltaBadge delta={row.delta} />
                  </span>
                  <span className={`text-center tabular-nums ${row.buts > 5 ? "text-vert font-medium" : "text-white/70"}`}>
                    {row.buts}
                  </span>
                  <span className="text-center tabular-nums text-white/70">{row.passes}</span>
                  <span className="text-center tabular-nums text-muted">{row.moyJoueur.toFixed(2)}</span>
                  <span className="text-center text-muted">
                    <ChevronDown
                      className={`w-4 h-4 mx-auto transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </span>
                </div>

                {/* Expanded detail sub-row */}
                {isExpanded && (
                  <div className="grid grid-cols-6 gap-3 px-4 py-3 bg-surface-2/60 border-b border-white/[0.05] text-xs">
                    <div className="text-center">
                      <span className="block text-muted uppercase tracking-wider mb-0.5">Pts G</span>
                      <span className="tabular-nums text-white/80 font-medium">{row.ptsG}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-muted uppercase tracking-wider mb-0.5">Pts D</span>
                      <span className="tabular-nums text-white/80 font-medium">{row.ptsD}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-muted uppercase tracking-wider mb-0.5">Pts M</span>
                      <span className="tabular-nums text-white/80 font-medium">{row.ptsM}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-muted uppercase tracking-wider mb-0.5">Pts A</span>
                      <span className="tabular-nums text-white/80 font-medium">{row.ptsA}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-muted uppercase tracking-wider mb-0.5">Prime</span>
                      <span className="tabular-nums text-gold-dim font-medium">{row.prime}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-muted uppercase tracking-wider mb-0.5">Note</span>
                      <span className="tabular-nums text-white/80 font-medium">{row.note.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom link */}
      <div className="flex justify-end">
        <Link href={`/ligue/${slug}/resultats`} className="text-sm text-gold hover:underline">
          Résultats de la journée &rarr;
        </Link>
      </div>
    </div>
  );
}
