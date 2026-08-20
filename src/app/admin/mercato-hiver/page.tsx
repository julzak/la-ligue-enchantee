"use client";

import { useState, useEffect, useCallback } from "react";
import { Snowflake, Loader2, Play, Square, CheckCircle, XCircle, ArrowRightLeft } from "lucide-react";

interface AuctionData {
  id: number;
  leagueId: number;
  status: string;
  currentRound: number;
  type: string;
}

interface Bid {
  userId: number;
  playerId: number;
  playerName: string;
  clubName: string;
  amount: number;
  status: string;
  playerOutId: number | null;
  playerOutName: string | null;
}

interface Participant {
  userId: number;
  userName: string;
  rank: number;
  totalPoints: number;
  winterBudget: number;
  assignedBudget?: number;
  budgetRemaining?: number;
  playersWon?: number;
}

interface League {
  id: number;
  dbId: number;
  name: string;
}

export default function MercatoHiverPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState(0);
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/jokers/leagues")
      .then((r) => r.json())
      .then((d) => setLeagues(d.leagues ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedLeague) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/mercato-hiver?leagueId=${selectedLeague}`);
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setAuction(data.auction);
        setBids(data.bids ?? []);
        setParticipants(data.participants ?? []);
      }
    } catch {
      setMessage("Erreur chargement");
    }
    setLoading(false);
  }, [selectedLeague]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAction(action: string) {
    const confirmMsg: Record<string, string> = {
      create: "Ouvrir le mercato d'hiver ? Les budgets seront calculés d'après le classement actuel.",
      open: "Ouvrir un nouveau tour d'enchères ?",
      "close-round": "Fermer les enchères pour ce tour ?",
      "resolve-round": "Résoudre le tour (attribuer les joueurs) ?",
      "close-auction": "Terminer définitivement le mercato d'hiver ?",
    };
    if (confirmMsg[action] && !confirm(confirmMsg[action])) return;

    setMessage("");
    try {
      const res = await fetch("/api/admin/mercato-hiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, leagueId: selectedLeague }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "OK");
      fetchData();
    } catch {
      setMessage("Erreur");
    }
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
          <Snowflake className="w-6 h-6 text-blue-400" />
          Mercato d&apos;hiver
        </h1>
        <p className="text-sm text-muted">Renforcement des effectifs en milieu de saison (1 IN = 1 OUT)</p>
        <p className="text-xs text-muted mt-1">
          Les jokers sont gelés pendant le mercato d&apos;hiver : les dates du gel se règlent dans{" "}
          <a href="/admin/config" className="text-gold hover:underline">Configuration → Mercato d&apos;hiver</a>
          {" "}(bannière automatique sur le site 7 jours avant le début).
        </p>
      </div>

      {/* League selector */}
      <div className="flex items-center gap-4">
        <select
          value={selectedLeague}
          onChange={(e) => setSelectedLeague(Number(e.target.value))}
          className="bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
        >
          <option value={0}>Selectionner une ligue</option>
          {leagues.map((l) => (
            <option key={l.dbId} value={l.dbId}>{l.name}</option>
          ))}
        </select>

        {auction && (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${
              auction.status === "open" ? "bg-vert/20 text-vert" :
              auction.status === "closed" ? "bg-blue-400/20 text-blue-400" :
              "bg-muted/20 text-muted"
            }`}>
              {auction.status === "open" ? "Tour ouvert" :
               auction.status === "closed" ? "Tour ferme" : "Termine"}
            </span>
            <span className="text-sm text-white">Tour {auction.currentRound}</span>
          </div>
        )}
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") || message.includes("deja") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : selectedLeague > 0 && (
        <>
          {/* Action buttons */}
          <div className="flex gap-3">
            {!auction && participants.length > 0 && (
              <button onClick={() => handleAction("create")} className="h-9 px-4 bg-blue-500 text-white rounded text-sm flex items-center gap-2 hover:bg-blue-500/80">
                <Snowflake className="w-4 h-4" /> Ouvrir le mercato d&apos;hiver
              </button>
            )}
            {(auction?.status === "resolved" || auction?.status === "closed") && (
              <button onClick={() => handleAction("open")} className="h-9 px-4 bg-vert text-white rounded text-sm flex items-center gap-2 hover:bg-vert/80">
                <Play className="w-4 h-4" /> Ouvrir tour suivant
              </button>
            )}
            {auction?.status === "open" && (
              <button onClick={() => handleAction("close-round")} className="h-9 px-4 bg-blue-400 text-night rounded text-sm flex items-center gap-2 hover:bg-blue-400/80">
                <Square className="w-4 h-4" /> Fermer le tour
              </button>
            )}
            {auction?.status === "closed" && (
              <>
                <button onClick={() => handleAction("resolve-round")} className="h-9 px-4 bg-blue-400 text-night rounded text-sm flex items-center gap-2 hover:bg-blue-400/80">
                  <CheckCircle className="w-4 h-4" /> Resoudre le tour
                </button>
                <button onClick={() => handleAction("resolve-tiebreak")} className="h-9 px-4 bg-surface-2 border border-blue-400/30 text-blue-400 rounded text-sm flex items-center gap-2 hover:bg-blue-400/10">
                  Tirage au sort (egalites)
                </button>
              </>
            )}
            {(auction?.status === "closed" || auction?.status === "resolved") && (
              <button onClick={() => handleAction("close-auction")} className="h-9 px-4 bg-rouge text-white rounded text-sm flex items-center gap-2 hover:bg-rouge/80">
                <XCircle className="w-4 h-4" /> Terminer le mercato
              </button>
            )}
          </div>

          {/* Participants with budget */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">
              Participants &mdash; Budgets {auction ? "attribues" : "prevus"} (classement actuel)
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {participants.map((p) => {
                const budget = p.assignedBudget ?? p.winterBudget;
                const remaining = p.budgetRemaining ?? budget;
                const won = p.playersWon ?? 0;
                return (
                  <div key={p.userId} className="bg-surface rounded-lg border border-white/[0.07] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-medium">{p.userName}</span>
                      <span className="text-[10px] text-muted">#{p.rank} &middot; {p.totalPoints} pts</span>
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-muted">
                      <span>Budget : <span className="text-blue-400 font-medium">{budget} pts</span></span>
                      {auction && (
                        <span>
                          Reste : <span className={remaining <= 0 ? "text-rouge" : "text-vert"}>{remaining}</span>
                          {won > 0 && <span className="ml-2 text-vert">{won} recrute{won > 1 ? "s" : ""}</span>}
                        </span>
                      )}
                    </div>
                    {auction && (
                      <div className="mt-1.5 h-1 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all"
                          style={{ width: `${budget > 0 ? ((budget - remaining) / budget) * 100 : 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current round bids */}
          {bids.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white mb-3">Encheres du tour {auction?.currentRound}</h3>
              <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
                <div className="grid grid-cols-[1fr_8rem_8rem_5rem_5rem] gap-1 px-4 py-2 text-[9px] uppercase tracking-wider text-muted border-b border-white/[0.07]">
                  <span>Joueur IN</span>
                  <span>Joueur OUT</span>
                  <span>Participant</span>
                  <span className="text-right">Mise</span>
                  <span className="text-right">Statut</span>
                </div>
                {Array.from(bidsByPlayer.entries()).map(([playerId, playerBids]) => (
                  playerBids.map((b, i) => (
                    <div
                      key={`${playerId}-${b.userId}`}
                      className={`grid grid-cols-[1fr_8rem_8rem_5rem_5rem] gap-1 px-4 py-2 items-center border-b border-white/[0.04] text-sm ${
                        b.status === "won" ? "bg-vert/5" : b.status === "tie" ? "bg-blue-400/5" : b.status === "lost" ? "bg-rouge/5 opacity-50" : ""
                      }`}
                    >
                      {i === 0 ? (
                        <span className="text-white flex items-center gap-1.5">
                          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          {b.playerName} <span className="text-[10px] text-muted">({b.clubName.split(" ")[0]})</span>
                        </span>
                      ) : (
                        <span></span>
                      )}
                      <span className="text-xs text-muted truncate">{b.playerOutName ?? "-"}</span>
                      <span className="text-xs text-muted">{participantNames.get(b.userId) ?? b.userId}</span>
                      <span className="text-right text-blue-400 font-medium tabular-nums">{b.amount}</span>
                      <span className={`text-right text-xs ${
                        b.status === "won" ? "text-vert" : b.status === "tie" ? "text-blue-400" : b.status === "lost" ? "text-rouge" : "text-muted"
                      }`}>
                        {b.status === "won" ? "Gagne" : b.status === "tie" ? "Egalite" : b.status === "lost" ? "Perdu" : "En attente"}
                      </span>
                    </div>
                  ))
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
