"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Gavel, Loader2, Search, Plus, Minus, Send } from "lucide-react";

interface AuctionState {
  id: number;
  status: string;
  currentRound: number;
  isOpen: boolean;
}

interface MyBid {
  playerId: number;
  playerName: string;
  clubName: string;
  amount: number;
  status: string;
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

export default function EncheresPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [budget, setBudget] = useState(0);
  const [playersWon, setPlayersWon] = useState(0);
  const [playersNeeded, setPlayersNeeded] = useState(13);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [wonPlayers, setWonPlayers] = useState<WonPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New bids being composed
  const [draftBids, setDraftBids] = useState<{ playerId: number; playerName: string; clubName: string; amount: number }[]>([]);
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
    } catch {}
    setLoading(false);
  }, [leagueDbId]);

  useEffect(() => { fetchAuction(); }, [fetchAuction]);

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
    setDraftBids((prev) => [...prev, { playerId: player.id, playerName: player.name, clubName: player.clubName, amount: 1 }]);
    setSearch("");
    setSearchResults([]);
  }

  function updateBidAmount(playerId: number, delta: number) {
    setDraftBids((prev) => prev.map((b) => b.playerId === playerId ? { ...b, amount: Math.max(1, b.amount + delta) } : b));
  }

  function removeBid(playerId: number) {
    setDraftBids((prev) => prev.filter((b) => b.playerId !== playerId));
  }

  const totalDraft = draftBids.reduce((sum, b) => sum + b.amount, 0);
  const budgetAfter = budget - totalDraft;

  async function submitBids() {
    if (draftBids.length === 0) return;
    if (budgetAfter < 0) { setMessage("Budget insuffisant"); return; }
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: leagueDbId,
          bids: draftBids.map((b) => ({ playerId: b.playerId, amount: b.amount })),
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
      setMessage("Erreur réseau");
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
        <p className="text-muted">Aucune enchère en cours pour cette ligue</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gavel className="w-6 h-6 text-gold" />
          <h2 className="font-serif text-xl text-white">Enchères — Tour {auction.currentRound}</h2>
          <span className={`text-xs px-2 py-1 rounded ${auction.isOpen ? "bg-vert/20 text-vert" : "bg-rouge/20 text-rouge"}`}>
            {auction.isOpen ? "Ouvert" : "Fermé"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-2xl font-serif font-bold text-gold">{budget}</span>
            <p className="text-xs text-muted mt-1">Points restants</p>
          </div>
          <div>
            <span className="text-2xl font-serif font-bold text-white">{playersWon}</span>
            <p className="text-xs text-muted mt-1">Joueurs acquis</p>
          </div>
          <div>
            <span className="text-2xl font-serif font-bold text-white/50">{playersNeeded}</span>
            <p className="text-xs text-muted mt-1">Encore à recruter</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {/* Place bids (only when open) */}
      {auction.isOpen && (
        <div className="space-y-4">
          <h3 className="font-serif text-base text-white">Placer vos enchères</h3>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Chercher un joueur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.07] rounded pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-gold"
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
            <div className="bg-surface rounded-lg border border-gold/20 overflow-hidden">
              {draftBids.map((b) => (
                <div key={b.playerId} className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] last:border-b-0">
                  <button onClick={() => removeBid(b.playerId)} className="text-rouge hover:text-rouge/70">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-white flex-1 truncate">{b.playerName}</span>
                  <span className="text-[10px] text-muted">{b.clubName.split(" ")[0]}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateBidAmount(b.playerId, -1)} className="w-6 h-6 rounded bg-surface-2 text-muted hover:text-white flex items-center justify-center text-xs">-</button>
                    <span className="text-sm text-gold font-bold w-8 text-center tabular-nums">{b.amount}</span>
                    <button onClick={() => updateBidAmount(b.playerId, 1)} className="w-6 h-6 rounded bg-surface-2 text-muted hover:text-white flex items-center justify-center text-xs">+</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
                <span className={`text-sm ${budgetAfter < 0 ? "text-rouge" : "text-muted"}`}>
                  Reste après enchères : <strong className="text-white">{budgetAfter}</strong> pts
                </span>
                <button
                  onClick={submitBids}
                  disabled={submitting || budgetAfter < 0}
                  className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enchérir
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* My current bids */}
      {myBids.length > 0 && (
        <div>
          <h3 className="font-serif text-base text-white mb-3">Mes enchères (tour {auction.currentRound})</h3>
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            {myBids.map((b) => (
              <div key={b.playerId} className={`flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] last:border-b-0 ${
                b.status === "won" ? "bg-vert/5" : b.status === "lost" ? "bg-rouge/5 opacity-50" : b.status === "tie" ? "bg-gold/5" : ""
              }`}>
                <span className="text-sm text-white flex-1">{b.playerName}</span>
                <span className="text-[10px] text-muted">{b.clubName.split(" ")[0]}</span>
                <span className="text-sm text-gold font-bold tabular-nums">{b.amount}</span>
                <span className={`text-xs ${
                  b.status === "won" ? "text-vert" : b.status === "lost" ? "text-rouge" : b.status === "tie" ? "text-gold" : "text-muted"
                }`}>
                  {b.status === "won" ? "✓" : b.status === "lost" ? "✗" : b.status === "tie" ? "=" : "⏳"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Won players */}
      {wonPlayers.length > 0 && (
        <div>
          <h3 className="font-serif text-base text-white mb-3">Mon effectif ({wonPlayers.length} joueurs)</h3>
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            {wonPlayers.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] last:border-b-0">
                <span className="text-[10px] text-muted w-8">{p.position.slice(0, 3)}</span>
                <span className="text-sm text-white flex-1">{p.playerName}</span>
                <span className="text-[10px] text-muted">{p.clubName.split(" ")[0]}</span>
                <span className="text-xs text-gold tabular-nums">{p.amount} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
