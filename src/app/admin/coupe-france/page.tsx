"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Loader2, Plus, Shuffle, Play, ChevronDown, Check } from "lucide-react";

interface CupInfo { id: number; name: string; status: string; season: string }
interface CupMatch {
  id: number; round: string; position: number; matchday: number | null;
  user1: { id: number; name: string } | null;
  user2: { id: number; name: string } | null;
  score1: number | null; score2: number | null;
  avg1: number | null; avg2: number | null;
  winnerId: number | null; winnerName: string | null;
}
interface Participant { id: number; cleanName: string; leagueName: string }
interface League { id: number; dbId: number; name: string }

export default function CoupeFrancePage() {
  const [cups, setCups] = useState<CupInfo[]>([]);
  const [selectedCup, setSelectedCup] = useState(0);
  const [matches, setMatches] = useState<CupMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // New cup creation
  const [showCreate, setShowCreate] = useState(false);
  const [newSeason, setNewSeason] = useState("2026-2027");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<number>>(new Set());
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  useEffect(() => {
    fetch("/api/admin/cup")
      .then((r) => r.json())
      .then((d) => setCups(d.cups ?? []))
      .catch(() => {});
    fetch("/api/admin/jokers/leagues")
      .then((r) => r.json())
      .then((d) => setLeagues(d.leagues ?? []))
      .catch(() => {});
  }, []);

  const fetchCup = useCallback(async () => {
    if (!selectedCup) return;
    setLoading(true);
    const res = await fetch(`/api/admin/cup?cupId=${selectedCup}`);
    const data = await res.json();
    setMatches(data.matches ?? []);
    setLoading(false);
  }, [selectedCup]);

  useEffect(() => { fetchCup(); }, [fetchCup]);

  // Load all participants for cup creation
  async function loadParticipants() {
    setLoadingParticipants(true);
    const all: Participant[] = [];
    for (const league of leagues) {
      const res = await fetch(`/api/admin/jokers/participants?leagueId=${league.dbId}`);
      const data = await res.json();
      (data.participants ?? []).forEach((p: { id: number; cleanName: string }) => {
        if (!all.some((a) => a.id === p.id)) {
          all.push({ ...p, leagueName: league.name });
        }
      });
    }
    setAllParticipants(all);
    setSelectedParticipants(new Set(all.map((p) => p.id)));
    setLoadingParticipants(false);
  }

  function toggleParticipant(id: number) {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLeague(leagueName: string) {
    const leagueParts = allParticipants.filter((p) => p.leagueName === leagueName);
    const allSelected = leagueParts.every((p) => selectedParticipants.has(p.id));
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      leagueParts.forEach((p) => allSelected ? next.delete(p.id) : next.add(p.id));
      return next;
    });
  }

  async function createCup() {
    if (selectedParticipants.size < 4) { setMessage("Minimum 4 participants"); return; }
    if (!confirm(`Créer la coupe ${newSeason} avec ${selectedParticipants.size} participants et tirage au sort ?`)) return;
    setMessage("");
    const res = await fetch("/api/admin/cup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-draw",
        season: newSeason,
        participantIds: Array.from(selectedParticipants),
      }),
    });
    const data = await res.json();
    setMessage(data.message ?? data.error);
    if (data.cupId) {
      setSelectedCup(data.cupId);
      setShowCreate(false);
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

  const rounds = Array.from(new Set(matches.map((m) => m.round)));
  const leagueGroups = new Map<string, Participant[]>();
  allParticipants.forEach((p) => {
    const arr = leagueGroups.get(p.leagueName) ?? [];
    arr.push(p);
    leagueGroups.set(p.leagueName, arr);
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-gold" />
          Coupe de France
        </h1>
        <p className="text-sm text-muted">Compétition interligue à élimination directe</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {cups.length > 0 && (
          <select
            value={selectedCup}
            onChange={(e) => { setSelectedCup(Number(e.target.value)); setShowCreate(false); }}
            className="bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
          >
            <option value={0}>Sélectionner une coupe</option>
            {cups.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.season})</option>
            ))}
          </select>
        )}

        <button
          onClick={() => { setShowCreate(!showCreate); setSelectedCup(0); if (!showCreate && allParticipants.length === 0) loadParticipants(); }}
          className="h-9 px-4 bg-gold text-night rounded text-sm font-semibold flex items-center gap-2 hover:bg-gold/80"
        >
          <Plus className="w-4 h-4" /> Nouvelle coupe
        </button>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") || message.includes("error") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {/* Create new cup */}
      {showCreate && (
        <div className="bg-surface rounded-lg border border-gold/20 p-6 space-y-4">
          <h3 className="font-serif text-base text-white">Nouvelle coupe</h3>

          <div className="flex items-center gap-3">
            <label className="text-sm text-muted">Saison :</label>
            <input
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
              className="bg-surface-2 border border-white/[0.07] rounded px-3 py-1.5 text-sm text-white w-32"
            />
            <span className="text-sm text-muted">({selectedParticipants.size} participants sélectionnés)</span>
          </div>

          {loadingParticipants ? (
            <Loader2 className="w-5 h-5 animate-spin text-gold" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from(leagueGroups.entries()).map(([leagueName, parts]) => {
                const allChecked = parts.every((p) => selectedParticipants.has(p.id));
                return (
                  <div key={leagueName} className="bg-surface-2 rounded-lg border border-white/[0.07] overflow-hidden">
                    <button
                      onClick={() => toggleLeague(leagueName)}
                      className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/[0.07] hover:bg-white/[0.02]"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${allChecked ? "bg-gold border-gold" : "border-white/20"}`}>
                        {allChecked && <Check className="w-3 h-3 text-night" />}
                      </div>
                      <span className="text-sm text-white font-medium">{leagueName}</span>
                      <span className="text-[10px] text-muted ml-auto">{parts.filter((p) => selectedParticipants.has(p.id)).length}/{parts.length}</span>
                    </button>
                    <div className="max-h-48 overflow-y-auto">
                      {parts.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedParticipants.has(p.id)}
                            onChange={() => toggleParticipant(p.id)}
                            className="accent-gold"
                          />
                          <span className="text-xs text-white/70">{p.cleanName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={createCup}
            disabled={selectedParticipants.size < 4}
            className="h-9 px-6 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/80 disabled:opacity-50 flex items-center gap-2"
          >
            <Shuffle className="w-4 h-4" /> Lancer le tirage au sort ({selectedParticipants.size} participants)
          </button>
        </div>
      )}

      {/* Bracket view */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : selectedCup > 0 && (
        <div className="space-y-6">
          {rounds.map((round) => {
            const roundMatches = matches.filter((m) => m.round === round);
            const firstMatch = roundMatches[0];
            const allResolved = roundMatches.every((m) => m.winnerId !== null || !m.user1 || !m.user2);
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
                    <div key={m.id} className="grid grid-cols-[1fr_3.5rem_auto_3.5rem_1fr] items-center px-4 py-2.5 gap-2">
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
