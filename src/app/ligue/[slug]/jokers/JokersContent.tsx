"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Loader2, Search, ArrowRight } from "lucide-react";

interface SquadPlayer {
  playerId: number;
  name: string;
  position: string;
  clubName: string;
  isSubs: boolean;
}

interface FreePlayer {
  id: number;
  name: string;
  position: string;
  clubName: string;
}

interface JokerLogEntry {
  id: number;
  playerOutName: string;
  playerInName: string;
  day: number;
}

interface ClubOption {
  id: number;
  name: string;
}

function posLabel(position: string): string {
  const lower = position.toLowerCase();
  if (lower.includes("gardien")) return "GK";
  if (lower.includes("fense") || lower.includes("défense")) return "DEF";
  if (lower.includes("milieu")) return "MIL";
  if (lower.includes("attaq")) return "ATT";
  return position.slice(0, 3).toUpperCase();
}

export function JokersContent({ leagueId, leagueSlug }: { leagueId: number; leagueSlug: string }) {
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [jokersRemaining, setJokersRemaining] = useState(0);
  const [jokerHistory, setJokerHistory] = useState<JokerLogEntry[]>([]);
  const [playerOut, setPlayerOut] = useState<number>(0);
  const [freePlayers, setFreePlayers] = useState<FreePlayer[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedClub, setSelectedClub] = useState<number>(0);
  const [freeSearch, setFreeSearch] = useState("");
  const [playerIn, setPlayerIn] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [executing, setExecuting] = useState(false);
  const [topicLink, setTopicLink] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jokers?leagueId=${leagueId}`);
      const d = await res.json();
      if (d.error) {
        setMessage("Erreur : " + d.error);
      } else {
        setSquad(d.squad ?? []);
        setJokersRemaining(d.jokersRemaining ?? 0);
        setJokerHistory(d.jokerHistory ?? []);
      }
    } catch {
      setMessage("Erreur de chargement");
    }
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load clubs list
  useEffect(() => {
    fetch(`/api/admin/jokers/free?leagueId=${leagueId}&clubId=1`)
      .then((r) => r.json())
      .then((d) => setClubs(d.clubs ?? []))
      .catch(() => {});
  }, [leagueId]);

  // Search free players
  useEffect(() => {
    if (!selectedClub && freeSearch.length < 2) {
      setFreePlayers([]);
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ leagueId: String(leagueId) });
      if (freeSearch.length >= 2) params.set("search", freeSearch);
      if (selectedClub) params.set("clubId", String(selectedClub));
      fetch(`/api/admin/jokers/free?${params}`)
        .then((r) => r.json())
        .then((d) => setFreePlayers(d.players ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [leagueId, freeSearch, selectedClub]);

  async function executeJoker() {
    if (!playerOut || !playerIn) return;
    if (!confirm("Confirmer le joker ? Cette action est definitive et ne peut pas etre annulee.")) return;
    setExecuting(true);
    setMessage("");
    setTopicLink(null);
    try {
      const res = await fetch("/api/jokers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, playerOutId: playerOut, playerInId: playerIn }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(data.message);
        if (data.topicId) {
          setTopicLink(`/forum/topic/${data.topicId}`);
        }
        setPlayerOut(0);
        setPlayerIn(0);
        setFreeSearch("");
        setSelectedClub(0);
        await loadData();
      } else {
        setMessage("Erreur : " + data.error);
      }
    } catch {
      setMessage("Erreur reseau");
    }
    setExecuting(false);
  }

  const outPlayer = squad.find((s) => s.playerId === playerOut);
  const inPlayer = freePlayers.find((p) => p.id === playerIn);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
            <Zap className="w-6 h-6 text-gold" />
            Jokers
          </h1>
          <p className="text-sm text-muted">
            Remplacer un joueur de votre effectif par un joueur libre.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-white/[0.07]">
          <Zap className="w-4 h-4 text-gold" />
          <span className="text-sm font-medium text-white">{jokersRemaining}</span>
          <span className="text-sm text-muted">joker{jokersRemaining !== 1 ? "s" : ""} restant{jokersRemaining !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
          {topicLink && (
            <a href={topicLink} className="ml-2 underline hover:text-white transition-colors">
              Voir le topic
            </a>
          )}
        </div>
      )}

      {jokersRemaining <= 0 && !loading && (
        <div className="bg-surface rounded-lg border border-white/[0.07] px-6 py-8 text-center">
          <Zap className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Plus de jokers disponibles</p>
          <p className="text-sm text-muted">Vous avez utilise tous vos jokers pour cette saison.</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : jokersRemaining > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: current squad — select player OUT */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Joueur a sortir</h3>
            <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
              {squad.length === 0 ? (
                <p className="text-sm text-muted p-4 text-center">Aucun joueur dans l&apos;effectif</p>
              ) : squad.map((s) => (
                <button
                  key={s.playerId}
                  onClick={() => setPlayerOut(s.playerId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-white/[0.04] last:border-b-0 transition-colors ${
                    playerOut === s.playerId
                      ? "bg-rouge/10 border-l-2 border-l-rouge"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <span className="text-[10px] text-muted w-7">{posLabel(s.position)}</span>
                  <span className="text-sm text-white flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] text-muted">{s.clubName.split(" ")[0]}</span>
                  {s.isSubs && <span className="text-[9px] bg-surface-2 px-1 rounded text-muted">REM</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Right: search free player IN */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Joueur a entrer</h3>

            <select
              value={selectedClub}
              onChange={(e) => {
                setSelectedClub(Number(e.target.value));
                setPlayerIn(0);
              }}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold mb-2"
            >
              <option value={0}>Tous les clubs</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Chercher un joueur libre..."
                value={freeSearch}
                onChange={(e) => setFreeSearch(e.target.value)}
                className="w-full bg-surface-2 border border-white/[0.07] rounded pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-gold"
              />
            </div>

            {freePlayers.length > 0 && (
              <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden max-h-80 overflow-y-auto">
                {freePlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlayerIn(p.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-white/[0.04] last:border-b-0 transition-colors ${
                      playerIn === p.id
                        ? "bg-vert/10 border-l-2 border-l-vert"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <span className="text-[10px] text-muted w-7">{posLabel(p.position)}</span>
                    <span className="text-sm text-white flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] text-muted">{p.clubName.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm swap */}
      {playerOut > 0 && playerIn > 0 && (
        <div className="bg-surface rounded-lg border border-gold/20 p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-rouge font-medium">{outPlayer?.name}</span>
            <ArrowRight className="w-4 h-4 text-gold" />
            <span className="text-vert font-medium">{inPlayer?.name}</span>
          </div>
          <button
            onClick={executeJoker}
            disabled={executing}
            className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Utiliser le joker
          </button>
        </div>
      )}

      {/* Joker history */}
      {jokerHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white mb-3">Historique de vos jokers</h3>
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_1fr] gap-1 px-4 py-2 text-[9px] uppercase tracking-wider text-muted border-b border-white/[0.07]">
              <span>Jour</span>
              <span>Sortant</span>
              <span>Entrant</span>
            </div>
            {jokerHistory.map((j) => (
              <div
                key={j.id}
                className="grid grid-cols-[3rem_1fr_1fr] gap-1 px-4 py-2 items-center border-b border-white/[0.04] text-sm"
              >
                <span className="text-xs text-muted tabular-nums">J{j.day}</span>
                <span className="text-rouge text-xs truncate">{j.playerOutName}</span>
                <span className="text-vert text-xs truncate">{j.playerInName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
