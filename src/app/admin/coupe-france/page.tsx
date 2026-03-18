"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Loader2, Shuffle, Play, ChevronDown } from "lucide-react";

interface CupInfo { id: number; name: string; status: string; season: string }
interface CupMatch {
  id: number; round: string; position: number; matchday: number | null;
  user1: { id: number; name: string } | null;
  user2: { id: number; name: string } | null;
  score1: number | null; score2: number | null;
  avg1: number | null; avg2: number | null;
  winnerId: number | null; winnerName: string | null;
}

export default function CoupeFrancePage() {
  const [cups, setCups] = useState<CupInfo[]>([]);
  const [selectedCup, setSelectedCup] = useState(0);
  const [matches, setMatches] = useState<CupMatch[]>([]);
  const [, setCupInfo] = useState<CupInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/cup")
      .then((r) => r.json())
      .then((d) => setCups(d.cups ?? []))
      .catch(() => {});
  }, []);

  const fetchCup = useCallback(async () => {
    if (!selectedCup) return;
    setLoading(true);
    const res = await fetch(`/api/admin/cup?cupId=${selectedCup}`);
    const data = await res.json();
    setCupInfo(data.cup);
    setMatches(data.matches ?? []);
    setLoading(false);
  }, [selectedCup]);

  useEffect(() => { fetchCup(); }, [fetchCup]);

  async function createDraw() {
    if (!confirm("Créer une nouvelle coupe avec tirage au sort ?")) return;
    setMessage("");
    const res = await fetch("/api/admin/cup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-draw" }),
    });
    const data = await res.json();
    setMessage(data.message ?? data.error);
    if (data.cupId) {
      setSelectedCup(data.cupId);
      // Refresh cups list
      const cupsRes = await fetch("/api/admin/cup");
      const cupsData = await cupsRes.json();
      setCups(cupsData.cups ?? []);
    }
  }

  async function resolveRound(round: string) {
    if (!confirm(`Résoudre le tour "${round}" ?`)) return;
    setMessage("");
    const res = await fetch("/api/admin/cup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve-round", cupId: selectedCup, round }),
    });
    const data = await res.json();
    setMessage(data.message ?? data.error);
    fetchCup();
  }

  async function setMatchday(round: string, matchday: number) {
    await fetch("/api/admin/cup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-matchday", cupId: selectedCup, round, matchday }),
    });
    fetchCup();
  }

  // Group matches by round
  const rounds = Array.from(new Set(matches.map((m) => m.round)));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-gold" />
          Coupe de France
        </h1>
        <p className="text-sm text-muted">Compétition interligue à élimination directe</p>
      </div>

      <div className="flex items-center gap-4">
        {cups.length > 0 && (
          <select
            value={selectedCup}
            onChange={(e) => setSelectedCup(Number(e.target.value))}
            className="bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
          >
            <option value={0}>Sélectionner une coupe</option>
            {cups.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.season})</option>
            ))}
          </select>
        )}

        <button
          onClick={createDraw}
          className="h-9 px-4 bg-gold text-night rounded text-sm font-semibold flex items-center gap-2 hover:bg-gold/80"
        >
          <Shuffle className="w-4 h-4" /> Nouveau tirage au sort
        </button>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") || message.includes("error") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : selectedCup > 0 && (
        <div className="space-y-6">
          {rounds.map((round) => {
            const roundMatches = matches.filter((m) => m.round === round);
            const firstMatch = roundMatches[0];
            const allResolved = roundMatches.every((m) => m.winnerId !== null);
            const hasMatchday = firstMatch?.matchday !== null;

            return (
              <div key={round} className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-white">{round}</h3>
                    <span className="text-[10px] text-muted">{roundMatches.length} matchs</span>
                    {hasMatchday && (
                      <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded">J{firstMatch.matchday}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Matchday selector */}
                    <div className="flex items-center gap-1">
                      <ChevronDown className="w-3 h-3 text-muted" />
                      <select
                        value={firstMatch?.matchday ?? ""}
                        onChange={(e) => setMatchday(round, Number(e.target.value))}
                        className="bg-surface border border-white/[0.07] rounded px-2 py-1 text-[10px] text-white"
                      >
                        <option value="">Journée</option>
                        {Array.from({ length: 38 }, (_, i) => i + 1).map((j) => (
                          <option key={j} value={j}>J{j}</option>
                        ))}
                      </select>
                    </div>
                    {!allResolved && hasMatchday && (
                      <button
                        onClick={() => resolveRound(round)}
                        className="h-7 px-3 bg-vert text-white rounded text-[10px] flex items-center gap-1 hover:bg-vert/80"
                      >
                        <Play className="w-3 h-3" /> Résoudre
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {roundMatches.map((m) => (
                    <div key={m.id} className="grid grid-cols-[1fr_3rem_auto_3rem_1fr] items-center px-4 py-2.5 gap-2">
                      <span className={`text-sm text-right truncate ${m.winnerId === m.user1?.id ? "text-gold font-medium" : m.winnerId ? "text-white/30" : "text-white"}`}>
                        {m.user1?.name ?? "—"}
                      </span>
                      <span className="text-sm text-right tabular-nums text-white/50">
                        {m.score1 !== null ? m.score1.toFixed(1) : ""}
                      </span>
                      <span className="text-xs text-muted px-1">vs</span>
                      <span className="text-sm tabular-nums text-white/50">
                        {m.score2 !== null ? m.score2.toFixed(1) : ""}
                      </span>
                      <span className={`text-sm truncate ${m.winnerId === m.user2?.id ? "text-gold font-medium" : m.winnerId ? "text-white/30" : "text-white"}`}>
                        {m.user2?.name ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
