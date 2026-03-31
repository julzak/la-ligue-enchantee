"use client";

import { useState, useEffect } from "react";
import { Zap, Loader2, Search, ArrowRight } from "lucide-react";

interface LeagueInfo {
  id: number;
  slug: string;
  name: string;
  dbId: number;
}

interface Participant {
  id: number;
  cleanName: string;
}

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

export default function JokersPage() {
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number>(0);
  const [selectedUser, setSelectedUser] = useState<number>(0);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [jokersRemaining, setJokersRemaining] = useState(2);
  const [playerOut, setPlayerOut] = useState<number>(0);
  const [freePlayers, setFreePlayers] = useState<FreePlayer[]>([]);
  const [freeSearch, setFreeSearch] = useState("");
  const [playerIn, setPlayerIn] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [executing, setExecuting] = useState(false);

  // Load leagues
  useEffect(() => {
    fetch("/api/admin/match-schedule?day=1") // just to check connectivity
      .catch(() => {});
    // Fetch leagues list
    fetch("/api/admin/jokers/leagues")
      .then((r) => r.json())
      .then((d) => setLeagues(d.leagues ?? []))
      .catch(() => {});
  }, []);

  // Load participants when league changes
  useEffect(() => {
    if (!selectedLeague) return;
    fetch(`/api/admin/jokers/participants?leagueId=${selectedLeague}`)
      .then((r) => r.json())
      .then((d) => setParticipants(d.participants ?? []))
      .catch(() => {});
    setSelectedUser(0);
    setSquad([]);
  }, [selectedLeague]);

  // Load squad when user changes
  useEffect(() => {
    if (!selectedLeague || !selectedUser) return;
    setLoading(true);
    fetch(`/api/admin/jokers?leagueId=${selectedLeague}&userId=${selectedUser}`)
      .then((r) => r.json())
      .then((d) => {
        setSquad(d.squad ?? []);
        setJokersRemaining(d.jokersRemaining ?? 2);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    setPlayerOut(0);
    setPlayerIn(0);
  }, [selectedLeague, selectedUser]);

  // Search free players
  useEffect(() => {
    if (!selectedLeague || freeSearch.length < 2) {
      setFreePlayers([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/admin/jokers/free?leagueId=${selectedLeague}&search=${encodeURIComponent(freeSearch)}`)
        .then((r) => r.json())
        .then((d) => setFreePlayers(d.players ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedLeague, freeSearch]);

  async function executeJoker() {
    if (!playerOut || !playerIn) return;
    if (!confirm("Confirmer le joker ?")) return;
    setExecuting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/jokers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeague,
          userId: selectedUser,
          playerOutId: playerOut,
          playerInId: playerIn,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(data.message);
        setPlayerOut(0);
        setPlayerIn(0);
        setFreeSearch("");
        // Reload squad
        const squadRes = await fetch(`/api/admin/jokers?leagueId=${selectedLeague}&userId=${selectedUser}`);
        const squadData = await squadRes.json();
        setSquad(squadData.squad ?? []);
        setJokersRemaining(squadData.jokersRemaining ?? 2);
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setExecuting(false);
  }

  const outPlayer = squad.find((s) => s.playerId === playerOut);
  const inPlayer = freePlayers.find((p) => p.id === playerIn);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Zap className="w-6 h-6 text-gold" />
          Jokers
        </h1>
        <p className="text-sm text-muted">Remplacer un joueur de l&apos;effectif par un joueur libre (4 jokers + 2 jokers d&apos;août par saison). Deadline : 18h la veille du 1er match de la journée.</p>
      </div>

      {/* Selectors */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={selectedLeague}
          onChange={(e) => setSelectedLeague(Number(e.target.value))}
          className="bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
        >
          <option value={0}>Sélectionner une ligue</option>
          {leagues.map((l) => (
            <option key={l.dbId} value={l.dbId}>{l.name}</option>
          ))}
        </select>

        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(Number(e.target.value))}
          disabled={!selectedLeague}
          className="bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold disabled:opacity-50"
        >
          <option value={0}>Sélectionner un participant</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>{p.cleanName}</option>
          ))}
        </select>

        {selectedUser > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded border border-white/[0.07]">
            <Zap className="w-4 h-4 text-gold" />
            <span className="text-sm text-white">{jokersRemaining} joker{jokersRemaining !== 1 ? "s" : ""} restant{jokersRemaining !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : selectedUser > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: current squad — select player OUT */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Joueur à sortir</h3>
            <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
              {squad.map((s) => (
                <button
                  key={s.playerId}
                  onClick={() => setPlayerOut(s.playerId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-white/[0.04] last:border-b-0 transition-colors ${
                    playerOut === s.playerId
                      ? "bg-rouge/10 border-l-2 border-l-rouge"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <span className="text-[10px] text-muted w-7">{s.position.slice(0, 3)}</span>
                  <span className="text-sm text-white flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] text-muted">{s.clubName.split(" ")[0]}</span>
                  {s.isSubs && <span className="text-[9px] bg-surface-2 px-1 rounded text-muted">REM</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Right: search free player IN */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Joueur à entrer</h3>
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
                    <span className="text-[10px] text-muted w-7">{p.position.slice(0, 3)}</span>
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
        <div className="bg-surface rounded-lg border border-gold/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-rouge font-medium">{outPlayer?.name}</span>
            <ArrowRight className="w-4 h-4 text-gold" />
            <span className="text-vert font-medium">{inPlayer?.name}</span>
          </div>
          <button
            onClick={executeJoker}
            disabled={executing || jokersRemaining <= 0}
            className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Utiliser le joker
          </button>
        </div>
      )}
    </div>
  );
}
