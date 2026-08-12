"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2, Search, X, Clock, Send, Lock, ArrowRightLeft, Minus, Plus } from "lucide-react";
import { validateSubmission } from "@/lib/auction-engine";
import type { Line, EnginePlayer } from "@/lib/auction-engine";
import { lineFromPosition } from "@/lib/auction-resolution";
import { findHardLimitErrors } from "@/lib/auction-hard-limits";
import { ResultsSection } from "./ResultsSection";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuctionState {
  id: number;
  status: string;
  currentRound: number;
  isOpen: boolean;
  type?: string;
  roundDeadline: string | null;
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

// Sérialisation canonique du panier (anti-écho de l'autosave brouillon) :
// deux paniers avec les mêmes (playerId, amount) sont identiques, peu importe l'ordre.
function serializeBids(bids: { playerId: number; amount: number }[]): string {
  return JSON.stringify(
    [...bids].sort((a, b) => a.playerId - b.playerId).map((b) => [b.playerId, b.amount])
  );
}

interface DraftBid {
  playerId: number;
  playerName: string;
  clubName: string;
  position: string;
  amount: number;
  // winter only
  playerOutId?: number;
  playerOutName?: string;
}

interface MyBid {
  playerId: number;
  playerName: string;
  clubName: string;
  position: string;
  amount: number;
  status: string;
  playerOutId?: number | null;
  playerOutName?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Délégué au mapping canonique du moteur (auction-resolution). L'ancienne
// copie locale ne reconnaissait pas "Défense" (elle attendait "défenseur") et
// son fallback était "ATT" : tous les défenseurs s'affichaient en ATT et se
// rangeaient dans la section Attaquants (signalé par Pierre, cas Coppola).
// Ne JAMAIS re-dériver ce mapping localement : une seule source de vérité.
const positionToLine = lineFromPosition;

function positionLabel(pos: string): string {
  const line = positionToLine(pos);
  if (line === "GK") return "G";
  // N7-fix : "MID" → "MIL" pour cohérence avec DEF/MIL/ATT (palette française)
  if (line === "MID") return "MIL";
  return line;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
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

const LINE_ORDER: { key: string; label: string; lineKey: Line; max: number }[] = [
  { key: "G",   label: "Gardien",    lineKey: "GK",  max: 1 },
  { key: "DEF", label: "Défenseurs", lineKey: "DEF", max: 6 },
  { key: "MIL", label: "Milieux",    lineKey: "MID", max: 6 },
  { key: "ATT", label: "Attaquants", lineKey: "ATT", max: 4 },
];

// ── Composant Ligne d'acquis (non retiable) ────────────────────────────────

function AcquisRow({ player }: { player: WonPlayer }) {
  return (
    <div className="relative flex items-center gap-3 px-3 py-2.5 bg-[#1A1A18] border border-[#272521] rounded-lg">
      {/* barre gauche gold-dim = acquis verrouillé */}
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-gold-dim" />
      <div className="w-8 h-8 flex-none rounded-full bg-[#242220] border border-[#34322B] flex items-center justify-center text-[11px] font-bold text-[#A8A294]">
        {initials(player.playerName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#D8D3C7] truncate">{player.playerName}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10.5px] text-muted">{player.clubName}</span>
          <span className="text-[9px] font-bold px-1 py-px rounded bg-white/[0.04] border border-[#34322B] text-[#8C877C] tracking-wider">{positionLabel(player.position)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[13.5px] font-bold text-[#C9C3B5] tabular-nums">{player.amount} pts</span>
        <span className="text-[8px] font-bold tracking-wider px-1.5 py-px rounded-full bg-gold/[0.13] border border-gold/[0.38] text-gold-dim">ACQUIS</span>
      </div>
    </div>
  );
}

// ── Composant Ligne de mise en cours d'édition ─────────────────────────────

function BidRow({
  bid,
  budget,
  onAmountChange,
  onRemove,
}: {
  bid: DraftBid;
  budget: number;
  onAmountChange: (id: number, v: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#201F1B] border border-gold/[0.24] rounded-lg">
      <div className="w-8 h-8 flex-none rounded-full bg-[#2C2A24] border border-[#443F33] flex items-center justify-center text-[11px] font-bold text-[#D2CCBD]">
        {initials(bid.playerName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-paper-dim truncate">{bid.playerName}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10.5px] text-muted">{bid.clubName}</span>
          <span className="text-[9px] font-bold px-1 py-px rounded bg-white/[0.05] border border-[#443F33] text-[#A39E92] tracking-wider">{positionLabel(bid.position)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-night border border-[#4A4538] rounded-lg px-2 py-1.5">
          <button
            onClick={() => onAmountChange(bid.playerId, bid.amount - 1)}
            className="text-muted hover:text-paper w-4 h-4 flex items-center justify-center text-sm leading-none"
            aria-label="Diminuer"
          >−</button>
          <input
            type="number"
            min={1}
            max={budget + bid.amount}
            value={bid.amount}
            onChange={(e) => onAmountChange(bid.playerId, parseInt(e.target.value) || 1)}
            className="w-10 text-center text-[15px] font-extrabold text-paper tabular-nums bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => onAmountChange(bid.playerId, bid.amount + 1)}
            className="text-muted hover:text-paper w-4 h-4 flex items-center justify-center text-sm leading-none"
            aria-label="Augmenter"
          >+</button>
        </div>
        <span className="text-[9px] text-muted/60">pts</span>
        <button onClick={() => onRemove(bid.playerId)} className="text-muted hover:text-rouge ml-1" aria-label="Retirer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Composant Emplacement vide ─────────────────────────────────────────────

function EmptySlot({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-3 py-2.5 border border-dashed border-[#3A382F] rounded-lg hover:border-gold/30 hover:bg-white/[0.01] transition-colors"
    >
      <div className="w-8 h-8 flex-none rounded-full border border-dashed border-[#46443A] flex items-center justify-center text-[#6E6A60] text-lg leading-none">+</div>
      <div className="flex-1 text-left">
        <div className="text-[12.5px] font-semibold text-[#9C978B]">Ajouter un joueur</div>
        <div className="text-[10px] text-[#6E6A60] mt-0.5">Rechercher par nom ou club</div>
      </div>
      <Search className="w-3.5 h-3.5 text-[#6E6A60]" />
    </button>
  );
}

// ── UI Mercato d'hiver (mode winter) ──────────────────────────────────────
// Rendu conditionnel : si isWinter, on utilise cette UI dédiée héritée de
// l'ancienne page (chemin de soumission complet avec sélecteur joueur sortant).

function WinterPage({
  auction,
  budget,
  leagueDbId,
  wonPlayers,
  myBids,
  squad,
  fetchAuction,
}: {
  auction: AuctionState;
  budget: number;
  leagueDbId: number;
  wonPlayers: WonPlayer[];
  myBids: MyBid[];
  squad: SquadPlayer[];
  fetchAuction: () => void;
}) {
  const [draftBids, setDraftBids] = useState<DraftBid[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FreePlayer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

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
      position: player.position,
      amount: 1,
    }]);
    setSearch("");
    setSearchResults([]);
  }

  function updateBidAmount(playerId: number, delta: number) {
    setDraftBids((prev) => prev.map((b) => b.playerId === playerId ? { ...b, amount: Math.max(1, b.amount + delta) } : b));
  }

  function setBidAmount(playerId: number, amount: number) {
    setDraftBids((prev) => prev.map((b) => b.playerId === playerId ? { ...b, amount: Math.max(1, amount) } : b));
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
  const usedOutIds = new Set(draftBids.map((b) => b.playerOutId).filter((id): id is number => !!id));
  const winterValid = draftBids.every((b) => b.playerOutId && b.playerOutId > 0);

  async function submitBids() {
    if (draftBids.length === 0) return;
    if (!winterValid) { setMessage("Chaque enchere doit designer un joueur sortant"); return; }
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
            playerOutId: b.playerOutId,
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
      setMessage("Erreur réseau");
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-6">
        <div className="flex items-center gap-3 mb-4">
          <ArrowRightLeft className="w-6 h-6 text-blue-400" />
          <h2 className="font-serif text-xl text-white">
            Mercato d&apos;hiver — Tour {auction.currentRound}
          </h2>
          <span className={`text-xs px-2 py-1 rounded ${auction.isOpen ? "bg-vert/20 text-vert" : "bg-rouge/20 text-rouge"}`}>
            {auction.isOpen ? "Ouvert" : "Fermé"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <span className="text-2xl font-serif font-bold text-blue-400">{budget}</span>
            <p className="text-xs text-muted mt-1">Points restants</p>
          </div>
          <div>
            <span className="text-2xl font-serif font-bold text-white">{wonPlayers.length}</span>
            <p className="text-xs text-muted mt-1">Joueurs recrutés</p>
          </div>
        </div>
        <p className="text-xs text-muted text-center mt-3 flex items-center justify-center gap-1.5">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Chaque recrutement implique la libération d&apos;un joueur (1 IN = 1 OUT)
        </p>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {/* Place bids (only when open) */}
      {auction.isOpen && (
        <div className="space-y-4">
          <h3 className="font-serif text-base text-white">Placer vos enchères (mercato d&apos;hiver)</h3>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Chercher un joueur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.07] rounded pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-blue-400"
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
            <div className="bg-surface rounded-lg border border-blue-400/20 overflow-hidden">
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
                        onChange={(e) => setBidAmount(b.playerId, parseInt(e.target.value) || 1)}
                        className="w-14 h-6 rounded bg-surface-2 border border-white/[0.07] text-sm text-blue-400 font-bold text-center tabular-nums focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => updateBidAmount(b.playerId, 1)} className="w-6 h-6 rounded bg-surface-2 text-muted hover:text-white flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>
                  {/* Player OUT selector */}
                  <div className="px-4 pb-2">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-rouge shrink-0" />
                      <span className="text-xs text-muted shrink-0">Joueur sortant :</span>
                      <select
                        value={b.playerOutId ?? ""}
                        onChange={(e) => setPlayerOut(b.playerId, Number(e.target.value))}
                        className="flex-1 bg-surface-2 border border-white/[0.07] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
                      >
                        <option value="">Choisir un joueur à libérer...</option>
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
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
                <span className={`text-sm ${budgetAfter < 0 ? "text-rouge" : "text-muted"}`}>
                  Reste après enchères : <strong className="text-white">{budgetAfter}</strong> pts
                </span>
                <button
                  onClick={submitBids}
                  disabled={submitting || !winterValid}
                  className="h-9 px-4 bg-blue-500 text-white font-semibold rounded text-sm hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
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
              <div key={b.playerId} className={`px-4 py-2 border-b border-white/[0.04] last:border-b-0 ${
                b.status === "won" ? "bg-vert/5"
                : b.status === "lost" ? "bg-rouge/5 opacity-50"
                : b.status === "tie" ? "bg-blue-400/5"
                : b.status === "removed" ? "bg-rouge/5 opacity-40"
                : ""
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white flex-1">{b.playerName}</span>
                  <span className="text-[10px] text-muted">{b.clubName.split(" ")[0]}</span>
                  <span className="text-sm text-blue-400 font-bold tabular-nums">{b.amount}</span>
                  <span className={`text-xs ${
                    b.status === "won" ? "text-vert"
                    : b.status === "lost" ? "text-rouge"
                    : b.status === "tie" ? "text-blue-400"
                    : b.status === "removed" ? "text-rouge/60"
                    : "text-muted"
                  }`}>
                    {b.status === "won" ? "✓"
                    : b.status === "lost" ? "✗"
                    : b.status === "tie" ? "="
                    : b.status === "removed" ? "Retirée (pénalité)"
                    : "⏳"}
                  </span>
                </div>
                {b.playerOutName && (
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
          <h3 className="font-serif text-base text-white mb-3">Recrutés cet hiver ({wonPlayers.length})</h3>
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            {wonPlayers.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] last:border-b-0">
                <span className="text-[10px] text-muted w-8">{p.position.slice(0, 3)}</span>
                <span className="text-sm text-white flex-1">{p.playerName}</span>
                <span className="text-[10px] text-muted">{p.clubName.split(" ")[0]}</span>
                <span className="text-xs text-blue-400 tabular-nums">{p.amount} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────

export default function EncheresPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [budget, setBudget] = useState(0);
  const [wonPlayers, setWonPlayers] = useState<WonPlayer[]>([]);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Onglet actif : 'bid' (soumettre ma mise) | 'results' (résultats)
  const [activeTab, setActiveTab] = useState<"bid" | "results">("bid");
  // Indique si des tours ont été dépouillés (pour afficher l'onglet Résultats)
  const [hasResults, setHasResults] = useState(false);

  // Compte à rebours
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Mises en cours de composition
  const [draftBids, setDraftBids] = useState<DraftBid[]>([]);

  // Brouillon auto-sauvegardé (décision 2026-08-12) : lastSyncedRef porte la
  // sérialisation du dernier état connu du serveur (brouillon sauvegardé ou
  // mise rechargée) pour que l'autosave ne ré-émette pas ce qu'il vient de
  // recevoir. draftSavedAt alimente l'indicateur "Brouillon enregistré à HH:MM".
  const lastSyncedRef = useRef<string>(serializeBids([]));
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // Recherche de joueurs libres
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FreePlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ID de la ligue (depuis le slug)
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
      setWonPlayers(data.wonPlayers ?? []);
      setMyBids(data.myBids ?? []);
      setSquad(data.squad ?? []);

      // M1 (amendé 2026-08-12) : charger le panier depuis le brouillon s'il
      // existe, sinon depuis la mise soumise (pending). lastSyncedRef est
      // aligné sur ce que le serveur renvoie pour couper l'écho de l'autosave.
      const draftRows: MyBid[] = (data.myBids ?? []).filter((b: MyBid) => b.status === "draft");
      const pending: MyBid[] = (data.myBids ?? []).filter((b: MyBid) => b.status === "pending");
      const source = draftRows.length > 0 ? draftRows : pending;
      if (source.length > 0) {
        const loaded = source.map((b) => ({
          playerId: b.playerId,
          playerName: b.playerName,
          clubName: b.clubName,
          position: b.position,
          amount: b.amount,
        }));
        lastSyncedRef.current = serializeBids(loaded);
        setDraftBids(loaded);
      }

      // Afficher l'onglet Résultats dès qu'il existe des mises résolues OU
      // qu'au moins un tour a été dépouillé (currentRound > 1). Le payload ne
      // contient que les mises du tour COURANT : après l'ouverture du tour
      // suivant, un participant sans nouvelle mise perdait tout accès à ses
      // résultats (retraits, égalités, motifs) alors que l'historique existe
      // dans /api/auction/results. Règle 3.2.d : consultables sur la plateforme.
      const resolved: MyBid[] = (data.myBids ?? []).filter((b: MyBid) =>
        ["won", "lost", "tie", "removed"].includes(b.status)
      );
      if (resolved.length > 0 || (data.auction?.currentRound ?? 1) > 1) setHasResults(true);
    } catch {}
    setLoading(false);
  }, [leagueDbId]);

  useEffect(() => { fetchAuction(); }, [fetchAuction]);

  // Compte à rebours
  useEffect(() => {
    if (!auction?.roundDeadline) { setSecondsLeft(null); return; }
    const deadline = new Date(auction.roundDeadline).getTime();
    const update = () => setSecondsLeft(Math.floor((deadline - Date.now()) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [auction?.roundDeadline]);

  // Recherche joueurs libres
  useEffect(() => {
    if (!leagueDbId || search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/admin/jokers/free?leagueId=${leagueDbId}&search=${encodeURIComponent(search)}`);
        const d = await res.json();
        // Exclure les joueurs déjà dans les mises en cours
        const draftIds = new Set(draftBids.map((b) => b.playerId));
        // Exclure aussi les acquis
        const wonIds = new Set(wonPlayers.map((w) => w.playerId));
        setSearchResults((d.players ?? []).filter((p: FreePlayer) => !draftIds.has(p.id) && !wonIds.has(p.id)));
      } catch {}
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [leagueDbId, search, draftBids, wonPlayers]);

  // ── Brouillon auto-sauvegardé (décision 2026-08-12) ──────────────────────
  // Toute modification du panier est persistée en brouillon serveur
  // (POST /api/auction avec draft:true) après un débounce court : le
  // participant qui attend la création d'un joueur (légion étrangère…) ne
  // perd plus sa saisie, sans avoir à soumettre une mise incomplète.
  useEffect(() => {
    if (loading || submitting || !leagueDbId || !auction || auction.type === "winter" || !auction.isOpen) return;
    const serialized = serializeBids(draftBids);
    if (serialized === lastSyncedRef.current) return;
    const timer = setTimeout(async () => {
      // Deadline vérifiée au moment de l'envoi, PAS via secondsLeft dans les
      // deps : le compte à rebours re-rend chaque seconde et casserait le débounce.
      if (auction.roundDeadline && new Date(auction.roundDeadline).getTime() <= Date.now()) return;
      try {
        const res = await fetch("/api/auction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId: leagueDbId,
            draft: true,
            bids: draftBids.map((b) => ({ playerId: b.playerId, amount: b.amount })),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          lastSyncedRef.current = serialized;
          setDraftSavedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
        }
      } catch {
        // silencieux : nouvelle tentative à la prochaine modification du panier
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [draftBids, auction, loading, submitting, leagueDbId]);

  // ── Actions ──────────────────────────────────────────────────────────────

  function addBid(player: FreePlayer) {
    if (draftBids.some((b) => b.playerId === player.id)) return;
    setDraftBids((prev) => [...prev, {
      playerId: player.id,
      playerName: player.name,
      clubName: player.clubName,
      position: player.position,
      amount: 1,
    }]);
    setSearch("");
    setSearchResults([]);
    setSearchOpen(false);
  }

  function updateAmount(playerId: number, val: number) {
    setDraftBids((prev) => prev.map((b) =>
      b.playerId === playerId ? { ...b, amount: Math.max(1, val) } : b
    ));
  }

  function removeBid(playerId: number) {
    setDraftBids((prev) => prev.filter((b) => b.playerId !== playerId));
  }

  // ── Calculs budget + avertissements ──────────────────────────────────────

  const totalDraft = draftBids.reduce((s, b) => s + b.amount, 0);
  const budgetAfter = budget - totalDraft;
  const over = budgetAfter < 0;

  // Construire les EnginePlayer pour validateSubmission
  const ownedEngine: EnginePlayer[] = wonPlayers.map((p) => ({
    id: p.playerId,
    lastName: p.playerName.split(" ").pop() ?? p.playerName,
    line: positionToLine(p.position),
  }));
  const bidsEngine = draftBids.map((b) => ({
    player: {
      id: b.playerId,
      lastName: b.playerName.split(" ").pop() ?? b.playerName,
      line: positionToLine(b.position),
    } as EnginePlayer,
    amount: b.amount,
  }));
  const warnings = validateSubmission(ownedEngine, bidsEngine, budget);
  // Le warning moteur "<13 au lieu de 13" (pénalité 3.2.c) n'est plus affiché
  // au participant : depuis le 2026-08-12 la soumission incomplète est bloquée,
  // et l'état "X / 13 · complétez" du footer porte déjà l'information.
  const displayWarnings = warnings.filter((w) => !w.includes("au lieu de 13"));

  // Erreur BLOQUANTE : plus d'un gardien dans la mise (acquis compris).
  // Décision 2026-06-11 — seul cas de rejet pour motif de composition.
  // N2-fix : utilise positionToLine (même mapping que le compteur de ligne UI) pour
  // compter les GK, plutôt que checkGoalkeeperLimit (qui ne reconnaît pas les
  // positions courtes "G" du seed recette et pourrait diverger de l'affichage).
  const gkCountUI =
    wonPlayers.filter((p) => positionToLine(p.position) === "GK").length +
    draftBids.filter((b) => positionToLine(b.position) === "GK").length;
  // On délègue toujours à checkGoalkeeperLimit côté serveur ; côté UI on se base
  // sur gkCountUI pour ne jamais avoir compteur et erreur qui se contredisent.
  const gkError: string | null = gkCountUI > 1
    ? `Votre mise contient ${gkCountUI} gardiens (acquis compris). Maximum autorisé : 1. La soumission est refusée tant que cette erreur n'est pas corrigée (règle du 2026-06-11).`
    : null;

  // Garde-fou ferme (décision 2026-08-10) : >13 joueurs, budget restant
  // dépassé, maxima de ligne. Mêmes règles et mêmes chiffres que le serveur
  // (validateSummerBids) : `budget` est déjà le budget restant renvoyé par l'API.
  const hardErrors = findHardLimitErrors({
    ownedLines: ownedEngine.map((p) => p.line),
    bidLines: bidsEngine.map((b) => b.player.line),
    bidTotal: totalDraft,
    budgetLeft: budget,
  });
  const blockingErrors: string[] = [...(gkError ? [gkError] : []), ...hardErrors];
  const hasBlocking = blockingErrors.length > 0;

  const totalFilled = wonPlayers.length + draftBids.length;

  // M4 : le dénominateur de la barre budget est le budget API (valeur fixe),
  // pas budget + totalDraft (qui varie à chaque frappe).
  const budgetMax = budget;
  const usedPct = budgetMax > 0 ? Math.min(100, Math.round((totalDraft / budgetMax) * 100)) : 0;

  // ── Soumission ────────────────────────────────────────────────────────────

  async function submitBids() {
    // M2 : pas d'exigence draftBids.length > 0 si 13 joueurs acquis (dernier tour)
    if (draftBids.length === 0 && wonPlayers.length < 13) return;
    setSubmitting(true);
    setMessage(null);
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
        const now = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
        setSubmittedAt(now);
        setMessage({ text: `Mise soumise le ${now}`, ok: true });
        // La soumission consomme le brouillon côté serveur : on réaligne
        // l'anti-écho pour que l'autosave ne recrée pas un draft identique.
        lastSyncedRef.current = serializeBids([]);
        setDraftSavedAt(null);
        setDraftBids([]);
        fetchAuction();
      } else {
        setMessage({ text: data.error ?? "Erreur", ok: false });
      }
    } catch {
      setMessage({ text: "Erreur réseau", ok: false });
    }
    setSubmitting(false);
  }

  // ── Render états ──────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>;
  }

  if (!auction) {
    return (
      <div className="text-center py-20">
        <p className="text-muted font-serif text-lg">Aucune enchère en cours pour cette ligue.</p>
      </div>
    );
  }

  // B2 : mode winter → UI dédiée héritée avec sélecteur joueur sortant
  const isWinter = auction.type === "winter";
  if (isWinter) {
    return (
      <WinterPage
        auction={auction}
        budget={budget}
        leagueDbId={leagueDbId}
        wonPlayers={wonPlayers}
        myBids={myBids}
        squad={squad}
        fetchAuction={fetchAuction}
      />
    );
  }

  const isClosed = !auction.isOpen;
  const deadlinePassed = secondsLeft !== null && secondsLeft <= 0;
  const isReadonly = isClosed || deadlinePassed;

  // M3 : mode "awaiting" = tour clôturé ET mise soumise (pending ou déjà résolue)
  // N3-fix : après dépouillement les mises passent en won/removed/tie (plus de pending).
  // Un participant qui a soumis ne doit pas voir le bandeau rouge "Soumission refusée" :
  //   - hasPendingBid  = tour clôturé, en attente de dépouillement (bandeau or)
  //   - hasTalliedBid  = tour dépouillé avec au moins une mise résolue (bandeau neutre/or)
  //   - isAwaiting     = l'un ou l'autre → masque le rouge "Soumission refusée"
  const hasPendingBid = myBids.some((b) => b.status === "pending");
  const hasTalliedBid = myBids.some((b) => ["won", "removed", "tie", "lost"].includes(b.status));
  // Brouillon jamais soumis : après la clôture, il faut le dire explicitement
  // (aucune mise prise en compte), pas un simple "Soumission refusée".
  const hasDraftBid = myBids.some((b) => b.status === "draft");
  const isAwaiting = isReadonly && (hasPendingBid || hasTalliedBid);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  // Si l'onglet Résultats est actif, on délègue entièrement à ResultsSection
  if (activeTab === "results" && hasResults) {
    return (
      <div className="max-w-lg mx-auto">
        {/* Tabs */}
        <div className="flex border-b border-[#232220] px-4 pt-3">
          <button
            onClick={() => setActiveTab("bid")}
            className="text-[13.5px] font-semibold px-4 pb-3 text-muted hover:text-paper transition-colors border-b-2 border-transparent"
          >
            Ma mise
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className="text-[13.5px] font-semibold px-4 pb-3 text-gold border-b-2 border-gold"
          >
            Résultats
          </button>
        </div>
        <ResultsSection leagueDbId={leagueDbId} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-0 pb-24">

      {/* Tabs — visibles si des tours ont été dépouillés */}
      {hasResults && (
        <div className="flex border-b border-[#232220] px-4 pt-3">
          <button
            onClick={() => setActiveTab("bid")}
            className="text-[13.5px] font-semibold px-4 pb-3 text-gold border-b-2 border-gold"
          >
            Ma mise
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className="text-[13.5px] font-semibold px-4 pb-3 text-muted hover:text-paper transition-colors border-b-2 border-transparent"
          >
            Résultats
          </button>
        </div>
      )}

      {/* ── HEADER : Tour + deadline + budget ── */}
      <div className="px-4 pt-4 pb-4 border-b border-[#232220] bg-gradient-to-b from-[#16160F] to-[#141414]">
        {/* Ligne tour + deadline */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-serif font-bold text-[22px] text-paper leading-none">
            Tour {auction.currentRound}
          </h2>
          {/* Badge deadline */}
          {auction.roundDeadline && !isReadonly && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11.5px] font-bold tabular-nums tracking-tight ${
              secondsLeft !== null && secondsLeft <= 300
                ? "bg-rouge/[0.12] border-rouge/45 text-[#E0705F]"
                : "bg-gold/[0.10] border-gold/35 text-[#D8BC63]"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${secondsLeft !== null && secondsLeft <= 300 ? "bg-rouge" : "bg-gold"} shadow-[0_0_6px_currentColor]`} />
              {secondsLeft !== null && secondsLeft > 0 ? formatCountdown(secondsLeft) : "Tour clôturé"}
            </div>
          )}
          {!auction.roundDeadline && !isReadonly && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[#322F2A] bg-white/[0.04] text-[11px] font-semibold text-[#A39E92]">
              <Clock className="w-3 h-3" />
              Clôture manuelle
            </div>
          )}
          {isReadonly && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-rouge/45 bg-rouge/[0.12] text-[11px] font-bold text-[#E0705F]">
              <Lock className="w-3 h-3" />
              Clôturé
            </div>
          )}
        </div>

        {/* Budget restant — chiffre roi */}
        <div className="mb-1">
          <div className="text-[9.5px] font-bold tracking-[1.6px] text-muted mb-1 uppercase">Budget restant</div>
          <div className="flex items-baseline gap-2">
            {over ? (
              <>
                <span className="text-[44px] font-extrabold leading-none text-rouge tabular-nums tracking-tight">−{Math.abs(budgetAfter)}</span>
                <span className="text-[12px] font-semibold text-rouge/80">dépassement / {budgetMax} pts</span>
              </>
            ) : (
              <>
                <span className="text-[44px] font-extrabold leading-none text-gold tabular-nums tracking-tight">{budgetAfter}</span>
                <span className="text-[13px] text-muted font-medium">/ {budgetMax} pts</span>
              </>
            )}
          </div>
        </div>

        {/* Barre de budget */}
        <div className="h-1.5 rounded-full bg-[#262421] overflow-hidden mt-2">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${usedPct}%`, background: over ? "#C0392B" : "#C8A84B" }}
          />
        </div>
        <div className="mt-1.5 text-[10.5px] text-[#7C776C]">
          {totalDraft > 0 ? `${totalDraft} pts engagés ce tour` : "Aucun point engagé"} · {totalFilled} / 13 joueurs
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── M3 : Bannière AWAITING (tour clôturé + mise soumise, en attente) ── */}
        {isAwaiting && hasPendingBid && !hasTalliedBid && (
          <div className="flex gap-3 p-3.5 bg-gold/[0.08] border border-gold/[0.30] rounded-lg">
            <span className="text-base flex-none mt-0.5">⏳</span>
            <div>
              <div className="text-[12.5px] font-bold text-[#D8BC63] mb-0.5">Tour clôturé — dépouillement en attente</div>
              <div className="text-[11.5px] text-[#A39E92] leading-relaxed">
                Votre mise a bien été enregistrée. Les résultats seront disponibles après le dépouillement.
              </div>
            </div>
          </div>
        )}

        {/* ── N3 : Bannière TALLIED (tour dépouillé + participant avait soumis) ── */}
        {isAwaiting && hasTalliedBid && (
          <div className="flex gap-3 p-3.5 bg-gold/[0.06] border border-gold/[0.22] rounded-lg">
            <span className="text-base flex-none mt-0.5">✓</span>
            <div>
              <div className="text-[12.5px] font-bold text-[#D8BC63] mb-0.5">Tour dépouillé — consultez vos résultats</div>
              <div className="text-[11.5px] text-[#A39E92] leading-relaxed">
                Votre mise a été traitée. Les acquisitions et résultats sont affichés ci-dessous.
              </div>
            </div>
          </div>
        )}

        {/* ── Bannière READONLY (tour clôturé + PAS de mise soumise) ── */}
        {isReadonly && !isAwaiting && (
          <div className="flex gap-3 p-3.5 bg-rouge/[0.10] border border-rouge/40 rounded-lg">
            <Lock className="w-4 h-4 text-[#E0705F] flex-none mt-0.5" />
            <div>
              <div className="text-[12.5px] font-bold text-[#E0705F] mb-0.5">
                {hasDraftBid ? "Brouillon non soumis" : "Soumission refusée"}
              </div>
              <div className="text-[11.5px] text-[#C9B7A0] leading-relaxed">
                {hasDraftBid
                  ? "Votre brouillon n'a pas été soumis avant la clôture : aucune mise n'est prise en compte pour ce tour."
                  : auction.roundDeadline
                  ? `Tour clôturé le ${new Date(auction.roundDeadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}. Toute soumission est désormais refusée.`
                  : "Ce tour est clôturé. Toute soumission est refusée."}
              </div>
            </div>
          </div>
        )}

        {/* ── Erreurs BLOQUANTES : gardiens, >13 joueurs, budget, maxima de ligne ── */}
        {!isReadonly && hasBlocking && (
          <div className="bg-rouge/[0.13] border border-rouge/50 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-sm">🚫</span>
              <span className="text-[11.5px] font-bold text-rouge tracking-tight">Soumission bloquée — composition invalide</span>
            </div>
            {blockingErrors.map((e, i) => (
              <div key={i} className="flex gap-2 px-3 py-2 border-t border-rouge/20">
                <span className="text-rouge text-[12px] leading-relaxed mt-px">•</span>
                <span className="text-[11.5px] text-[#E0B0A8] leading-relaxed">{e}</span>
              </div>
            ))}
            <div className="px-3 py-2 border-t border-rouge/20 text-[10.5px] text-rouge/70 italic">
              Corrigez votre mise pour débloquer la soumission (décision du 2026-08-10 : 13 joueurs max, budget restant max, maxima de ligne).
            </div>
          </div>
        )}

        {/* ── Avertissements de composition (bandeau ambre non bloquant) ── */}
        {/* N4-fix : masqués à l'état vide (0 joueur), affichés dès qu'une mise ou un acquis existe */}
        {!isReadonly && displayWarnings.length > 0 && totalFilled > 0 && (
          <div className="bg-[#D69634]/[0.10] border border-[#D69634]/42 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-sm">⚠️</span>
              <span className="text-[11.5px] font-bold text-[#E0A94E] tracking-tight">Avertissements de composition</span>
            </div>
            {displayWarnings.map((w, i) => (
              <div key={i} className="flex gap-2 px-3 py-2 border-t border-[#D69634]/18">
                <span className="text-[#E0A94E] text-[12px] leading-relaxed mt-px">•</span>
                <span className="text-[11.5px] text-[#D8CBB6] leading-relaxed">{w}</span>
              </div>
            ))}
            <div className="px-3 py-2 border-t border-[#D69634]/18 text-[10.5px] text-[#9C8E73] italic">
              Vous pouvez soumettre malgré ces avertissements.
            </div>
          </div>
        )}

        {/* ── Message de confirmation ou d'erreur ── */}
        {message && (
          <div className={`px-3 py-2.5 rounded-lg text-[12.5px] font-medium ${
            message.ok ? "bg-vert/[0.10] border border-vert/40 text-[#3FB873]" : "bg-rouge/[0.10] border border-rouge/40 text-rouge"
          }`}>
            {message.ok ? "✓ " : "✗ "}{message.text}
          </div>
        )}

        {/* ── Liste des joueurs par ligne ── */}
        {LINE_ORDER.map((line) => {
          const acquis = wonPlayers.filter((p) => positionToLine(p.position) === line.lineKey);
          const bids = draftBids.filter((b) => positionToLine(b.position) === line.lineKey);
          const total = acquis.length + bids.length;
          const isOver = total > line.max;

          return (
            <div key={line.key}>
              {/* En-tête de ligne */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold tracking-[1.4px] text-muted uppercase">{line.label}</span>
                <span className={`text-[10.5px] font-bold tabular-nums ${isOver ? "text-rouge" : "text-[#7C776C]"}`}>
                  {total} / {line.max}
                </span>
              </div>

              <div className="space-y-1.5">
                {/* Acquis pré-remplis (non retirables) */}
                {acquis.map((p) => (
                  <AcquisRow key={p.playerId} player={p} />
                ))}

                {/* Mises en cours d'édition */}
                {!isReadonly && bids.map((b) => (
                  <BidRow
                    key={b.playerId}
                    bid={b}
                    budget={budgetAfter + b.amount} // budget si on retire ce joueur
                    onAmountChange={updateAmount}
                    onRemove={removeBid}
                  />
                ))}

                {/* Ligne locked (après clôture) */}
                {isReadonly && bids.map((b) => (
                  <div key={b.playerId} className="flex items-center gap-3 px-3 py-2.5 bg-[#1A1A18] border border-[#272521] rounded-lg">
                    <div className="w-8 h-8 flex-none rounded-full bg-[#242220] border border-[#34322B] flex items-center justify-center text-[11px] font-bold text-[#A8A294]">
                      {initials(b.playerName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#D8D3C7] truncate">{b.playerName}</div>
                      <span className="text-[10.5px] text-muted">{b.clubName}</span>
                    </div>
                    <span className="text-[13px] font-bold text-[#C9C3B5] tabular-nums">{b.amount} pts</span>
                  </div>
                ))}

                {/* Emplacement vide → ouvre la recherche */}
                {!isReadonly && (
                  <EmptySlot onOpen={() => setSearchOpen(true)} />
                )}
              </div>
            </div>
          );
        })}

        {/* ── m1 : Hint "premier tour vide" — uniquement quand les mises sont ouvertes ── */}
        {!isReadonly && totalFilled === 0 && wonPlayers.length === 0 && (
          <div className="text-center py-4 px-4">
            <p className="font-serif italic text-[17px] text-paper mb-1.5">Constituez votre équipe</p>
            <p className="text-[12px] text-muted leading-relaxed">13 joueurs · {budgetMax} points · ajoutez vos joueurs ligne par ligne ci-dessus.</p>
          </div>
        )}

        {/* ── Résultats du tour précédent : mises avec statut resolved ── */}
        {/* Inclut le statut 'removed' (pénalité dépouillement) pour que le participant
            voit quels joueurs lui ont été retirés. Naît au dépouillement été. */}
        {(() => {
          const resolvedBids = myBids.filter((b) => b.status !== "pending");
          if (resolvedBids.length === 0) return null;
          return (
            <div>
              <div className="text-[10px] font-bold tracking-[1.4px] text-muted uppercase mb-2">Résultats du tour {auction.currentRound}</div>
              <div className="space-y-1">
                {resolvedBids.map((b) => (
                  <div
                    key={b.playerId}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      b.status === "won"
                        ? "bg-vert/[0.07] border-vert/30"
                        : b.status === "removed"
                        ? "bg-rouge/[0.08] border-rouge/25 opacity-70"
                        : b.status === "lost" || b.status === "tie"
                        ? "bg-[#1A1A18] border-[#272521] opacity-60"
                        : "bg-[#1A1A18] border-[#272521]"
                    }`}
                  >
                    <div className="w-8 h-8 flex-none rounded-full bg-[#242220] border border-[#34322B] flex items-center justify-center text-[11px] font-bold text-[#A8A294]">
                      {initials(b.playerName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#D8D3C7] truncate">{b.playerName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10.5px] text-muted">{b.clubName}</span>
                        <span className="text-[9px] font-bold px-1 py-px rounded bg-white/[0.04] border border-[#34322B] text-[#8C877C] tracking-wider">{positionLabel(b.position)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[13px] font-bold text-[#C9C3B5] tabular-nums">{b.amount} pts</span>
                      <span className={`text-[9px] font-bold tracking-wider px-1.5 py-px rounded-full border ${
                        b.status === "won"
                          ? "bg-vert/[0.15] border-vert/40 text-[#3FB873]"
                          : b.status === "removed"
                          ? "bg-rouge/[0.15] border-rouge/35 text-[#E0705F]"
                          : b.status === "lost"
                          ? "bg-rouge/[0.08] border-rouge/20 text-rouge/60"
                          : b.status === "tie"
                          // N8-fix : or atténué (gold-dim) — remplace le bleu hors palette
                          ? "bg-gold/[0.10] border-gold/25 text-gold-dim"
                          : "bg-white/[0.04] border-[#34322B] text-muted"
                      }`}>
                        {b.status === "won" ? "ACQUIS"
                          : b.status === "removed" ? "RETIRÉ (pénalité)"
                          : b.status === "lost" ? "PERDU"
                          : b.status === "tie" ? "ÉGALITÉ"
                          : b.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      </div>

      {/* ── Drawer de recherche ── */}
      {searchOpen && !isReadonly && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setSearchOpen(false); setSearch(""); }} />
          <div className="relative bg-[#1B1B19] border-t border-gold/[0.28] rounded-t-2xl max-h-[70vh] flex flex-col shadow-2xl">
            {/* Header drawer */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#232220]">
              <span className="text-[13.5px] font-bold text-paper">Ajouter un joueur</span>
              <button onClick={() => { setSearchOpen(false); setSearch(""); }} className="text-muted hover:text-paper">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Search input */}
            <div className="px-4 py-3 border-b border-[#232220]">
              <div className="flex items-center gap-2 px-3 py-2 bg-night border border-[#322F2A] rounded-lg">
                <Search className="w-3.5 h-3.5 text-[#7C776C] flex-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Rechercher un joueur, un club…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[13px] text-paper placeholder:text-[#7C776C] outline-none"
                />
                {searchLoading && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />}
              </div>
              <p className="mt-2 text-[10.5px] text-[#7C776C] italic">Les joueurs déjà attribués à un autre participant n&apos;apparaissent pas. Les gardiens sont des entrées par club.</p>
            </div>
            {/* Résultats */}
            <div className="overflow-y-auto flex-1">
              {searchResults.length === 0 && search.length >= 2 && !searchLoading && (
                <div className="px-4 py-6 text-center text-[12px] text-muted">Aucun joueur libre trouvé pour &quot;{search}&quot;</div>
              )}
              {searchResults.length === 0 && search.length < 2 && (
                <div className="px-4 py-6 text-center text-[12px] text-muted">Tapez au moins 2 caractères pour rechercher</div>
              )}
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addBid(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-[#201F1D] hover:bg-white/[0.03] text-left"
                >
                  <div className="w-9 h-9 flex-none rounded-full bg-[#2A2824] border border-[#38362F] flex items-center justify-center text-[11px] font-bold text-[#C9C3B5]">
                    {initials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-paper-dim truncate">{p.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10.5px] text-muted">{p.clubName}</span>
                      <span className="text-[9px] font-bold px-1 py-px rounded bg-white/[0.05] border border-[#38362F] text-[#A39E92] tracking-wider">{positionLabel(p.position)}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-gold px-2.5 py-1.5 border border-gold/40 rounded-lg flex-none">Ajouter</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER sticky : bouton soumission ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#16160F] border-t border-[#2A2824] px-4 py-3">
        {/* M3 : mode awaiting → footer vert "Mise soumise" */}
        {isAwaiting ? (
          <div className="flex gap-3 px-4 py-3.5 bg-vert/[0.10] border border-vert/40 rounded-xl">
            <span className="w-5 h-5 flex-none rounded-full bg-vert/25 border border-vert flex items-center justify-center text-[10px] text-[#3FB873]">✓</span>
            <div>
              <div className="text-[13px] font-bold text-[#3FB873]">Mise soumise</div>
              {submittedAt && (
                <div className="text-[11px] text-[#A39E92] mt-0.5">{submittedAt} · résultats à venir après dépouillement.</div>
              )}
            </div>
          </div>
        ) : isReadonly ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 px-4 py-3.5 bg-[#201F1C] border border-[#322F2A] rounded-xl">
              <Lock className="w-4 h-4 text-[#6E6A60]" />
              <span className="text-[14px] font-bold text-[#7C776C]">Soumission close</span>
            </div>
            {submittedAt && (
              <div className="text-center text-[10.5px] text-muted">Dernière soumission : {submittedAt}</div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Indicateur conformité */}
            <div className="flex items-center gap-2">
              {hasBlocking ? (
                <>
                  <span className="text-[12px]">🚫</span>
                  <span className="text-[11px] text-rouge font-semibold">Soumission bloquée — corrigez votre mise</span>
                </>
              ) : totalFilled !== 13 ? (
                // Décision 2026-08-12 : la soumission incomplète est bloquée
                // (plus de "soumission autorisée" en ambre pour <13). L'avancement
                // est sauvegardé automatiquement en brouillon.
                <>
                  <span className="w-2 h-2 rounded-full bg-muted" />
                  <span className="text-[11px] text-[#9C978B] font-semibold">{totalFilled} / 13 joueurs · complétez votre mise pour soumettre</span>
                </>
              ) : displayWarnings.length > 0 ? (
                // N4-fix : le footer ambre n'apparaît qu'à partir du moment où le joueur a saisi quelque chose
                <>
                  <span className="text-[12px]">⚠️</span>
                  <span className="text-[11px] text-[#E0A94E] font-semibold">Mise non conforme — soumission autorisée</span>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 rounded-full bg-vert/20 border border-vert flex items-center justify-center text-[9px] text-[#3FB873]">✓</span>
                  <span className="text-[11px] text-[#3FB873] font-semibold">Composition conforme · 13 / 13 joueurs</span>
                </>
              )}
            </div>
            {/* M2 : 13 = acquis + mise, donc bouton actif avec 0 mise si 13 acquis (dernier tour).
                Décision 2026-08-12 : bloqué tant que l'effectif n'est pas exactement à 13. */}
            <button
              onClick={submitBids}
              disabled={submitting || hasBlocking || totalFilled !== 13}
              title={hasBlocking ? blockingErrors.join(" ") : undefined}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gold text-night font-bold text-[14.5px] rounded-xl hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Soumettre ma mise
            </button>
            {draftSavedAt && (
              <div className="text-center text-[10px] text-[#E0A94E]">
                Brouillon enregistré à {draftSavedAt} · non soumis{hasPendingBid ? " — votre dernière mise soumise reste valable" : ""}
              </div>
            )}
            <div className="text-center text-[10px] text-muted italic">Remplace toute mise précédente de ce tour.</div>
          </div>
        )}
      </div>

    </div>
  );
}
