"use client";

import { useState, useEffect, useCallback } from "react";
import { Gavel, Loader2, Play, Square, CheckCircle, XCircle, Clock } from "lucide-react";

interface AuctionData {
  id: number;
  leagueId: number;
  status: string;
  currentRound: number;
  budget: number;
  playersPerUser: number;
  roundDeadline: string | null; // ISO 8601
}

interface Bid {
  userId: number;
  playerId: number;
  playerName: string;
  clubName: string;
  amount: number;
  status: string;
}

interface Participant {
  userId: number;
  userName: string;
  budget: number;
  playersWon: number;
  playersNeeded: number;
}

interface League {
  id: number;
  dbId: number;
  name: string;
}

/** Convertit un DateTime ISO en valeur compatible avec <input type="datetime-local"> */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEncheresPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState(0);
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Deadline UI state
  const [deadlineInput, setDeadlineInput] = useState("");
  const [deadlineLoading, setDeadlineLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/jokers/leagues")
      .then((r) => r.json())
      .then((d) => setLeagues(d.leagues ?? []))
      .catch(() => {});
  }, []);

  const fetchAuction = useCallback(async () => {
    if (!selectedLeague) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/auction?leagueId=${selectedLeague}`);
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setAuction(data.auction);
        setBids(data.bids ?? []);
        setParticipants(data.participants ?? []);
        // Pré-remplir le champ deadline si déjà renseignée
        setDeadlineInput(data.auction?.roundDeadline ? isoToDatetimeLocal(data.auction.roundDeadline) : "");
      }
    } catch {
      setMessage("Erreur chargement");
    }
    setLoading(false);
  }, [selectedLeague]);

  useEffect(() => { fetchAuction(); }, [fetchAuction]);

  async function handleAction(action: string, extraBody?: Record<string, unknown>) {
    const confirmMsg: Record<string, string> = {
      open: "Ouvrir un nouveau tour d'enchères ?",
      "close-round": "Fermer les enchères pour ce tour ?",
      "resolve-round": "Résoudre le tour (attribuer les joueurs) ?",
      "close-auction": "Terminer définitivement l'enchère ?",
    };
    if (confirmMsg[action] && !confirm(confirmMsg[action])) return;

    setMessage("");
    try {
      const res = await fetch("/api/admin/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, leagueId: selectedLeague, ...extraBody }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "OK");
      fetchAuction();
    } catch {
      setMessage("Erreur");
    }
  }

  async function handleSetDeadline() {
    setDeadlineLoading(true);
    setMessage("");
    // deadlineInput vide = effacer la deadline ; sinon convertir en ISO
    const deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    try {
      const res = await fetch("/api/admin/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-deadline", leagueId: selectedLeague, deadline }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "OK");
      fetchAuction();
    } catch {
      setMessage("Erreur");
    }
    setDeadlineLoading(false);
  }

  // Group bids by player
  const bidsByPlayer = new Map<number, Bid[]>();
  bids.forEach((b) => {
    const arr = bidsByPlayer.get(b.playerId) ?? [];
    arr.push(b);
    bidsByPlayer.set(b.playerId, arr);
  });

  const participantNames = new Map(participants.map((p) => [p.userId, p.userName]));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Gavel className="w-6 h-6 text-gold" />
          Enchères
        </h1>
        <p className="text-sm text-muted">Gestion des enchères de joueurs par ligue</p>
      </div>

      {/* League selector */}
      <div className="flex items-center gap-4">
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

        {auction && (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${
              auction.status === "open" ? "bg-vert/20 text-vert" :
              auction.status === "closed" ? "bg-gold/20 text-gold" :
              "bg-muted/20 text-muted"
            }`}>
              {auction.status === "open" ? "Tour ouvert" :
               auction.status === "closed" ? "Tour fermé" : "Terminée"}
            </span>
            <span className="text-sm text-white">Tour {auction.currentRound}</span>
          </div>
        )}
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") || message.includes("invalide") || message.includes("Pas de") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : selectedLeague > 0 && (
        <>
          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            {(!auction || auction.status === "resolved" || auction.status === "closed") && (
              <button onClick={() => handleAction("open")} className="h-9 px-4 bg-vert text-white rounded text-sm flex items-center gap-2 hover:bg-vert/80">
                <Play className="w-4 h-4" /> {auction ? "Ouvrir tour suivant" : "Démarrer les enchères"}
              </button>
            )}
            {auction?.status === "open" && (
              <button onClick={() => handleAction("close-round")} className="h-9 px-4 bg-gold text-night rounded text-sm flex items-center gap-2 hover:bg-gold/80">
                <Square className="w-4 h-4" /> Clôturer le tour
              </button>
            )}
            {auction?.status === "closed" && (
              <button onClick={() => handleAction("resolve-round")} className="h-9 px-4 bg-gold text-night rounded text-sm flex items-center gap-2 hover:bg-gold/80">
                <CheckCircle className="w-4 h-4" /> Résoudre le tour
              </button>
            )}
            {(auction?.status === "closed" || auction?.status === "resolved") && (
              <button onClick={() => handleAction("close-auction")} className="h-9 px-4 bg-rouge text-white rounded text-sm flex items-center gap-2 hover:bg-rouge/80">
                <XCircle className="w-4 h-4" /> Terminer l&apos;enchère
              </button>
            )}
          </div>

          {/* Deadline panel — visible uniquement si tour ouvert */}
          {auction?.status === "open" && (
            <div className="bg-surface rounded-lg border border-white/[0.07] p-4 space-y-3">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold" />
                Heure butoir du tour {auction.currentRound}
              </h3>
              <p className="text-xs text-muted">
                Optionnelle. Si renseignée, toute mise reçue après ce moment est rejetée (tolérance 0, timestamp serveur). La clôture manuelle fonctionne dans tous les cas.
              </p>
              {auction.roundDeadline && (
                <p className="text-xs text-gold font-medium">
                  Butoir actuel : {new Date(auction.roundDeadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="bg-surface-2 border border-white/[0.07] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gold"
                />
                <button
                  onClick={handleSetDeadline}
                  disabled={deadlineLoading}
                  className="h-8 px-3 bg-gold text-night rounded text-xs font-semibold hover:bg-gold/80 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deadlineLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                  {deadlineInput ? "Enregistrer" : "Effacer le butoir"}
                </button>
              </div>
            </div>
          )}

          {/* Participants status */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Participants</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {participants.map((p) => (
                <div key={p.userId} className="bg-surface rounded-lg border border-white/[0.07] px-4 py-3">
                  <span className="text-sm text-white font-medium">{p.userName}</span>
                  <div className="flex justify-between mt-1 text-xs text-muted">
                    <span>{p.budget} pts restants</span>
                    <span>{p.playersWon}/{auction?.playersPerUser ?? 13} joueurs</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full"
                      style={{ width: `${(p.playersWon / (auction?.playersPerUser ?? 13)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current round bids */}
          {bids.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white mb-3">Enchères du tour {auction?.currentRound}</h3>
              <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
                <div className="grid grid-cols-[1fr_8rem_5rem_5rem] gap-1 px-4 py-2 text-[9px] uppercase tracking-wider text-muted border-b border-white/[0.07]">
                  <span>Joueur</span>
                  <span>Participant</span>
                  <span className="text-right">Mise</span>
                  <span className="text-right">Statut</span>
                </div>
                {Array.from(bidsByPlayer.entries()).map(([playerId, playerBids]) => (
                  playerBids.map((b, i) => (
                    <div
                      key={`${playerId}-${b.userId}`}
                      className={`grid grid-cols-[1fr_8rem_5rem_5rem] gap-1 px-4 py-2 items-center border-b border-white/[0.04] text-sm ${
                        b.status === "won" ? "bg-vert/5" : b.status === "tie" ? "bg-gold/5" : b.status === "lost" ? "bg-rouge/5 opacity-50" : ""
                      }`}
                    >
                      {i === 0 ? (
                        <span className="text-white">{b.playerName} <span className="text-[10px] text-muted">({b.clubName.split(" ")[0]})</span></span>
                      ) : (
                        <span></span>
                      )}
                      <span className="text-xs text-muted">{participantNames.get(b.userId) ?? b.userId}</span>
                      <span className="text-right text-gold font-medium tabular-nums">{b.amount}</span>
                      <span className={`text-right text-xs ${
                        b.status === "won" ? "text-vert" : b.status === "tie" ? "text-gold" : b.status === "lost" ? "text-rouge" : "text-muted"
                      }`}>
                        {b.status === "won" ? "Gagné" : b.status === "tie" ? "Égalité" : b.status === "lost" ? "Perdu" : "En attente"}
                      </span>
                    </div>
                  ))
                ))
              }</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
