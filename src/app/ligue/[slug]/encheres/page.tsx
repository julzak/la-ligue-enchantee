"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Gavel, Loader2, Search, Plus, Minus, Send, Snowflake, ArrowRightLeft, Clock } from "lucide-react";

interface AuctionState {
  id: number;
  status: string;
  currentRound: number;
  isOpen: boolean;
  type?: string;
  roundDeadline: string | null; // ISO 8601
}

interface MyBid {
  playerId: number;
  playerName: string;
  clubName: string;
  amount: number;
  status: string;
  playerOutId?: number | null;
  playerOutName?: string | null;
}

interface WonPlayer {
  playerId: number;
  playerName: string;
  clubName: string;
  position: string;
  amount: number;
}

interface FreePlayer {
  id: number;
  name: string;
  position: string;
  clubName: string;
}

interface SquadPlayer {
  playerId: number;
  playerName: string;
  position: string;
  clubName: string;
}

interface DraftBid {
  playerId: number;
  playerName: string;
  clubName: string;
  amount: number;
  playerOutId?: number;
  playerOutName?: string;
}

/** Formate un nombre de secondes en "Xh Ym Zs" ou "Ym Zs" ou "Zs" */
function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "0s";
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function EncheresPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [budget, setBudget] = useState(0);
  const [playersWon, setPlayersWon] = useState(0);
  const [playersNeeded, setPlayersNeeded] = useState(13);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [wonPlayers, setWonPlayers] = useState<WonPlayer[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Compte à rebours deadline
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // New bids being composed
  const [draftBids, setDraftBids] = useState<DraftBid[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FreePlayer[]>([]);

  // Get leagueDbId from slug
  const [leagueDbId, setLeagueDbId] = useState(0);
  useEffect(() => {
    fetch("/api/admin/jokers/leagues")
      .then((r) => r.json())
      .then((d) => {
        const league = (d.leagues ?? []).find((l: { slug: string }) => l.slug === slug);
        if (league) setLeagueDbId(league.dbId);
      })
      .catch(() => {});
  }, [slug]);

  const fetchAuction = useCallback(async () => {
    if (!leagueDbId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/auction?leagueId=${leagueDbId}`);
      const data = await res.json();
      setAuction(data.auction);
      setBudget(data.budget ?? 0);
      setPlayersWon(data.playersWon ?? 0);
      setPlayersNeeded(data.playersNeeded ?? 13);
      setMyBids(data.myBids ?? []);
      setWonPlayers(data.wonPlayers ?? []);
      setSquad(data.squad ?? []);
    } catch {}
    setLoading(false);
  }, [leagueDbId]);

  useEffect(() => { fetchAuction(); }, [fetchAuction]);

  // Démarrer le compte à rebours quand la deadline est connue
  useEffect(() => {
    if (!auction?.roundDeadline) {
      setSecondsLeft(null);
      return;
    }
    const deadline = new Date(auction.roundDeadline).getTime();
    const update = () => {
      const diff = Math.floor((deadline - Date.now()) / 1000);
      setSecondsLeft(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [auction?.roundDeadline]);

  const isWinter = auction?.type === "winter";

  // Search free players
  useEffect(() => {
    if (!leagueDbId || search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/admin/jokers/free?leagueId=${leagueDbId}&search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.players ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [leagueDbId, search]);

  function addBid(player: FreePlayer) {
    if (draftBids.some((b) => b.playerId === player.id)) return;
    setDraftBids((prev) => [...prev, {
      playerId: player.id,
      playerName: player.name,
      clubName: player.clubName,
      amount: 1,
    }]);
    setSearch("");
    setSearchResults([]);
  }

  function updateBidAmount(playerId: number, delta: number) {
    setDraftBids((prev) => prev.map((b) => b.playerId === playerId ? { ...b, amount: Math.max(1, b.amount + delta) } : b));
  }

  function setBidAmount(playerId: number, amount: number) {
    setDraftBids((prev) => prev.map((b) => b.playerId === playerId ? { ...b, amount } : b));
  }

  function setPlayerOut(playerId: number, playerOutId: number) {
    const outPlayer = squad.find((s) => s.playerId === playerOutId);
    setDraftBids((prev) => prev.map((b) => b.playerId === playerId ? {
      ...b,
      playerOutId,
      playerOutName: outPlayer?.playerName ?? "",
    } : b));
  }

  function removeBid(playerId: number) {
    setDraftBids((prev) => prev.filter((b) => b.playerId !== playerId));
  }

  const totalDraft = draftBids.reduce((sum, b) => sum + b.amount, 0);
  const budgetAfter = budget - totalDraft;

  // For winter: track which squad players are already selected as "out"
  const usedOutIds = new Set(draftBids.map((b) => b.playerOutId).filter((id): id is number => !!id));

  // Validation for winter: all bids must have a player_out
  const winterValid = !isWinter || draftBids.every((b) => b.playerOutId && b.playerOutId > 0);

  async function submitBids() {
    if (draftBids.length === 0) return;
    if (budgetAfter < 0) { setMessage("Budget insuffisant"); return; }
    if (isWinter && !winterValid) { setMessage("Chaque enchere doit designer un joueur sortant"); return; }

    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: leagueDbId,
          bids: draftBids.map((b) => ({
            playerId: b.playerId,
            amount: b.amount,
            ...(isWinter ? { playerOutId: b.playerOutId } : {}),
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(data.message);
        setDraftBids([]);
        fetchAuction();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur reseau");
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>;
  }

  if (!auction) {
    return (
      <div className="text-center py-20">
        <Gavel className="w-12 h-12 text-muted mx-auto mb-4" />
        <p className="text-muted">Aucune enchere en cours pour cette ligue</p>
      </div>
    );
  }

  const accentColor = isWinter ? "blue-400" : "gold";
  const AuctionIcon = isWinter ? Snowflake : Gavel;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-6">
        <div className="flex items-center gap-3 mb-4">
          <AuctionIcon className={`w-6 h-6 ${isWinter ? "text-blue-400" : "text-gold"}`} />
          <h2 className="font-serif text-xl text-white">
            {isWinter ? "Mercato d'hiver" : "Encheres"} &mdash; Tour {auction.currentRound}
          </h2>
          <span className={`text-xs px-2 py-1 rounded ${auction.isOpen ? "bg-vert/20 text-vert" : "bg-rouge/20 text-rouge"}`}>
            {auction.isOpen ? "Ouvert" : "Ferme"}
          </span>
        </div>
        <div className={`grid ${isWinter ? "grid-cols-2" : "grid-cols-3"} gap-4 text-center`}>
          <div>
            <span className={`text-2xl font-serif font-bold ${isWinter ? "text-blue-400" : "text-gold"}`}>{budget}</span>
            <p className="text-xs text-muted mt-1">Points restants</p>
          </div>
          <div>
            <span className="text-2xl font-serif font-bold text-white">{playersWon}</span>
            <p className="text-xs text-muted mt-1">Joueurs {isWinter ? "recrutes" : "acquis"}</p>
          </div>
          {!isWinter && (
            <div>
              <span className="text-2xl font-serif font-bold text-white/50">{playersNeeded}</span>
              <p className="text-xs text-muted mt-1">Encore a recruter</p>
            </div>
          )}
        </div>

        {/* Deadline / compte a rebours */}
        {auction.isOpen && (
          <div className={`mt-4 flex items-center justify-center gap-2 text-xs rounded px-3 py-2 ${
            auction.roundDeadline
              ? secondsLeft !== null && secondsLeft <= 300
                ? "bg-rouge/15 text-rouge"
                : "bg-gold/10 text-gold"
              : "bg-white/5 text-muted"
          }`}>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {auction.roundDeadline ? (
              secondsLeft !== null && secondsLeft <= 0 ? (
                <span>Tour clôturé — aucune mise acceptée</span>
              ) : (
                <span>
                  Clôture le{" "}
                  {new Date(auction.roundDeadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  {secondsLeft !== null && secondsLeft > 0 && (
                    <strong className="ml-1">— {formatCountdown(secondsLeft)}</strong>
                  )}
                </span>
              )
            ) : (
              <span>Clôture manuelle par l&apos;admin</span>
            )}
          </div>
        )}

        {isWinter && (
          <p className="text-xs text-muted text-center mt-3 flex items-center justify-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Chaque recrutement implique la liberation d&apos;un joueur (1 IN = 1 OUT)
          </p>
        )}
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {/* Place bids (only when open) */}
      {auction.isOpen && (
        <div className="space-y-4">
          <h3 className="font-serif text-base text-white">
            {isWinter ? "Placer vos encheres (mercato d'hiver)" : "Placer vos encheres"}
          </h3>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Chercher un joueur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full bg-surface-2 border border-white/[0.07] rounded pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-${accentColor}`}
            />
          </div>

          {searchResults.length > 0 && (
            <div className="bg-surface rounded-lg border border-white/[0.07] max-h-48 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addBid(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/[0.03] border-b border-white/[0.04] last:border-b-0"
                >
                  <Plus className="w-3 h-3 text-vert" />
                  <span className="text-[10px] text-muted w-8">{p.position.slice(0, 3)}</span>
                  <span className="flex-1 text-left truncate">{p.name}</span>
                  <span className="text-[10px] text-muted">{p.clubName.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Draft bids */}
          {draftBids.length > 0 && (
            <div className={`bg-surface rounded-lg border ${isWinter ? "border-blue-400/20" : "border-gold/20"} overflow-hidden`}>
              {draftBids.map((b) => (
                <div key={b.playerId} className="border-b border-white/[0.04] last:border-b-0">
                  <div className="flex items-center gap-2 px-4 py-2">
                    <button onClick={() => removeBid(b.playerId)} className="text-rouge hover:text-rouge/70">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-white flex-1 truncate">{b.playerName}</span>
                    <span className="text-[10px] text-muted">{b.clubName.split(" ")[0]}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateBidAmount(b.playerId, -1)} className="w-6 h-6 rounded bg-surface-2 text-muted hover:text-white flex items-center justify-center text-xs">-</button>
                      <input
                        type="number"
                        min={1}
                        max={budget}
                        value={b.amount}
                        onChange={(e) => setBidAmount(b.playerId, Math.max(1, parseInt(e.target.value) || 1))}
                        className={`w-14 h-6 rounded bg-surface-2 border border-white/[0.07] text-sm ${isWinter ? "text-blue-400" : "text-gold"} font-bold text-center tabular-nums focus:outline-none focus:border-${accentColor} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      />
                      <button onClick={() => updateBidAmount(b.playerId, 1)} className="w-6 h-6 rounded bg-surface-2 text-muted hover:text-white flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>

                  {/* Winter: player OUT selector */}
                  {isWinter && (
                    <div className="px-4 pb-2">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-rouge shrink-0" />
                        <span className="text-xs text-muted shrink-0">Joueur sortant :</span>
                        <select
                          value={b.playerOutId ?? ""}
                          onChange={(e) => setPlayerOut(b.playerId, Number(e.target.value))}
                          className="flex-1 bg-surface-2 border border-white/[0.07] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
                        >
                          <option value="">Choisir un joueur a liberer...</option>
                          {squad
                            .filter((s) => !usedOutIds.has(s.playerId) || s.playerId === b.playerOutId)
                            .map((s) => (
                              <option key={s.playerId} value={s.playerId}>
                                {s.playerName} ({s.position.slice(0, 3)}) - {s.clubName.split(" ")[0]}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
                <span className={`text-sm ${budgetAfter < 0 ? "text-rouge" : "text-muted"}`}>
                  Reste apres encheres : <strong className="text-white">{budgetAfter}</strong> pts
                </span>
                <button
                  onClick={submitBids}
                  disabled={submitting || budgetAfter < 0 || (isWinter && !winterValid)}
                  className={`h-9 px-4 ${isWinter ? "bg-blue-500" : "bg-gold"} text-${isWinter ? "white" : "night"} font-semibold rounded text-sm hover:opacity-90 flex items-center gap-2 disabled:opacity-50`}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Encherir
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* My current bids */}
      {myBids.length > 0 && (
        <div>
          <h3 className="font-serif text-base text-white mb-3">Mes encheres (tour {auction.currentRound})</h3>
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            {myBids.map((b) => (
              <div key={b.playerId} className={`px-4 py-2 border-b border-white/[0.04] last:border-b-0 ${
                b.status === "won" ? "bg-vert/5" : b.status === "lost" ? "bg-rouge/5 opacity-50" : b.status === "tie" ? "bg-blue-400/5" : ""
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white flex-1">{b.playerName}</span>
                  <span className="text-[10px] text-muted">{b.clubName.split(" ")[0]}</span>
                  <span className={`text-sm ${isWinter ? "text-blue-400" : "text-gold"} font-bold tabular-nums`}>{b.amount}</span>
                  <span className={`text-xs ${
                    b.status === "won" ? "text-vert" : b.status === "lost" ? "text-rouge" : b.status === "tie" ? "text-blue-400" : "text-muted"
                  }`}>
                    {b.status === "won" ? "\u2713" : b.status === "lost" ? "\u2717" : b.status === "tie" ? "=" : "\u23F3"}
                  </span>
                </div>
                {isWinter && b.playerOutName && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <ArrowRightLeft className="w-3 h-3 text-rouge" />
                    <span className="text-[11px] text-muted">Sortant : <span className="text-rouge/80">{b.playerOutName}</span></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Won players */}
      {wonPlayers.length > 0 && (
        <div>
          <h3 className="font-serif text-base text-white mb-3">
            {isWinter ? `Recrutes cet hiver (${wonPlayers.length})` : `Mon effectif (${wonPlayers.length} joueurs)`}
          </h3>
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            {wonPlayers.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] last:border-b-0">
                <span className="text-[10px] text-muted w-8">{p.position.slice(0, 3)}</span>
                <span className="text-sm text-white flex-1">{p.playerName}</span>
                <span className="text-[10px] text-muted">{p.clubName.split(" ")[0]}</span>
                <span className={`text-xs ${isWinter ? "text-blue-400" : "text-gold"} tabular-nums`}>{p.amount} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
