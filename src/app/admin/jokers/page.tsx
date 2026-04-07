"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Loader2, Search, ArrowRight, Undo2 } from "lucide-react";

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

interface JokerLogEntry {
  id: number;
  playerOutId: number;
  playerOutName: string;
  playerInId: number;
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

export default function JokersPage() {
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number>(0);
  const [selectedUser, setSelectedUser] = useState<number>(0);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [jokersRemaining, setJokersRemaining] = useState(2);
  const [jokerHistory, setJokerHistory] = useState<JokerLogEntry[]>([]);
  const [playerOut, setPlayerOut] = useState<number>(0);
  const [freePlayers, setFreePlayers] = useState<FreePlayer[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedClub, setSelectedClub] = useState<number>(0);
  const [freeSearch, setFreeSearch] = useState("");
  const [playerIn, setPlayerIn] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [executing, setExecuting] = useState(false);
  const [canceling, setCanceling] = useState<number>(0);
  const [overrideDay, setOverrideDay] = useState<number>(0);

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
      .then((d) => {
        const sorted = (d.participants ?? []).sort((a: Participant, b: Participant) =>
          a.cleanName.localeCompare(b.cleanName, "fr")
        );
        setParticipants(sorted);
      })
      .catch(() => {});
    setSelectedUser(0);
    setSquad([]);
    setJokerHistory([]);
  }, [selectedLeague]);

  // Load clubs list for filter
  useEffect(() => {
    if (!selectedLeague) return;
    fetch(`/api/admin/jokers/free?leagueId=${selectedLeague}&clubId=1`)
      .then((r) => r.json())
      .then((d) => setClubs(d.clubs ?? []))
      .catch(() => {});
  }, [selectedLeague]);

  const loadSquadData = useCallback(async () => {
    if (!selectedLeague || !selectedUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jokers?leagueId=${selectedLeague}&userId=${selectedUser}`);
      const d = await res.json();
      setSquad(d.squad ?? []);
      setJokersRemaining(d.jokersRemaining ?? 2);
      setJokerHistory(d.jokerHistory ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [selectedLeague, selectedUser]);

  // Load squad when user changes
  useEffect(() => {
    loadSquadData();
    setPlayerOut(0);
    setPlayerIn(0);
  }, [loadSquadData]);

  // Search free players
  useEffect(() => {
    if (!selectedLeague) {
      setFreePlayers([]);
      return;
    }
    // Need either a club filter or a search term of >= 2 chars
    if (!selectedClub && freeSearch.length < 2) {
      setFreePlayers([]);
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ leagueId: String(selectedLeague) });
      if (freeSearch.length >= 2) params.set("search", freeSearch);
      if (selectedClub) params.set("clubId", String(selectedClub));
      fetch(`/api/admin/jokers/free?${params}`)
        .then((r) => r.json())
        .then((d) => setFreePlayers(d.players ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedLeague, freeSearch, selectedClub]);

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
          ...(overrideDay > 0 ? { day: overrideDay } : {}),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(data.message);
        setPlayerOut(0);
        setPlayerIn(0);
        setFreeSearch("");
        setSelectedClub(0);
        await loadSquadData();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setExecuting(false);
  }

  async function cancelJoker(jokerLogId: number) {
    if (!confirm("Annuler ce joker ? Le joueur sorti reviendra dans l'effectif.")) return;
    setCanceling(jokerLogId);
    setMessage("");
    try {
      const res = await fetch("/api/admin/jokers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jokerLogId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(data.message);
        await loadSquadData();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setCanceling(0);
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
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded border border-white/[0.07]">
              <Zap className="w-4 h-4 text-gold" />
              <span className="text-sm text-white">{jokersRemaining} joker{jokersRemaining !== 1 ? "s" : ""} restant{jokersRemaining !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted">Journee :</label>
              <select
                value={overrideDay}
                onChange={(e) => setOverrideDay(Number(e.target.value))}
                className="bg-surface-2 border border-white/[0.07] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
              >
                <option value={0}>Actuelle</option>
                {Array.from({ length: 38 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>J{d}</option>
                ))}
              </select>
            </div>
          </>
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
            <h3 className="text-sm font-medium text-white mb-3">Joueur à entrer</h3>

            {/* Club filter */}
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

      {/* Joker history */}
      {jokerHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white mb-3">Historique des jokers</h3>
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_1fr_5rem] gap-1 px-4 py-2 text-[9px] uppercase tracking-wider text-muted border-b border-white/[0.07]">
              <span>Jour</span>
              <span>Sortant</span>
              <span>Entrant</span>
              <span className="text-right">Action</span>
            </div>
            {jokerHistory.map((j) => (
              <div
                key={j.id}
                className="grid grid-cols-[3rem_1fr_1fr_5rem] gap-1 px-4 py-2 items-center border-b border-white/[0.04] text-sm"
              >
                <span className="text-xs text-muted tabular-nums">J{j.day}</span>
                <span className="text-rouge text-xs truncate">{j.playerOutName}</span>
                <span className="text-vert text-xs truncate">{j.playerInName}</span>
                <div className="flex justify-end">
                  <button
                    onClick={() => cancelJoker(j.id)}
                    disabled={canceling === j.id}
                    className="h-7 px-2 text-xs text-muted hover:text-rouge hover:bg-rouge/10 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="Annuler ce joker"
                  >
                    {canceling === j.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Undo2 className="w-3 h-3" />
                    )}
                    Annuler
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
