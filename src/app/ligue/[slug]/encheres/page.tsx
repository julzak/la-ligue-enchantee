"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, Search, X, Clock, Send, Lock } from "lucide-react";
import { validateSubmission } from "@/lib/auction-engine";
import type { Line, EnginePlayer } from "@/lib/auction-engine";

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

interface DraftBid {
  playerId: number;
  playerName: string;
  clubName: string;
  position: string;
  amount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function positionToLine(pos: string): Line {
  const p = pos.toLowerCase();
  if (p.includes("ardien") || p === "gk" || p === "g") return "GK";
  if (p === "def" || p.includes("défenseur") || p.includes("defenseur")) return "DEF";
  if (p === "mid" || p === "mil" || p.includes("milieu")) return "MID";
  return "ATT";
}

function positionLabel(pos: string): string {
  const line = positionToLine(pos);
  if (line === "GK") return "G";
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

// ── Page principale ────────────────────────────────────────────────────────

export default function EncheresPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [budget, setBudget] = useState(0);
  const [wonPlayers, setWonPlayers] = useState<WonPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Compte à rebours
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Mises en cours de composition
  const [draftBids, setDraftBids] = useState<DraftBid[]>([]);

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

  const totalFilled = wonPlayers.length + draftBids.length;
  const isConform = warnings.length === 0 && totalFilled === 13;

  // Calcul bar budget
  const spentDraft = totalDraft;
  const budgetMax = budget + totalDraft; // = budget initial restant avant draft
  // On affiche sur base du budget restant (avant engagement du draft)
  const usedPct = budgetMax > 0 ? Math.min(100, Math.round((spentDraft / budgetMax) * 100)) : 0;

  // ── Soumission ────────────────────────────────────────────────────────────

  async function submitBids() {
    if (draftBids.length === 0 && wonPlayers.length === 0) return;
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
        setMessage({ text: `Mise enregistrée le ${now}`, ok: true });
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

  const isWinter = auction.type === "winter";
  const isClosed = !auction.isOpen;
  const deadlinePassed = secondsLeft !== null && secondsLeft <= 0;
  const isReadonly = isClosed || deadlinePassed;

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto space-y-0 pb-24">

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
          {spentDraft > 0 ? `${spentDraft} pts engagés ce tour` : "Aucun point engagé"} · {totalFilled} / 13 joueurs
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Bannière CLÔTURÉ ── */}
        {isReadonly && (
          <div className="flex gap-3 p-3.5 bg-rouge/[0.10] border border-rouge/40 rounded-lg">
            <Lock className="w-4 h-4 text-[#E0705F] flex-none mt-0.5" />
            <div>
              <div className="text-[12.5px] font-bold text-[#E0705F] mb-0.5">Soumission refusée</div>
              <div className="text-[11.5px] text-[#C9B7A0] leading-relaxed">
                {auction.roundDeadline
                  ? `Tour clôturé le ${new Date(auction.roundDeadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}. Toute soumission est désormais refusée.`
                  : "Ce tour est clôturé. Toute soumission est refusée."}
              </div>
            </div>
          </div>
        )}

        {/* ── Avertissements de composition (bandeau ambre non bloquant) ── */}
        {!isReadonly && warnings.length > 0 && (
          <div className="bg-[#D69634]/[0.10] border border-[#D69634]/42 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-sm">⚠️</span>
              <span className="text-[11.5px] font-bold text-[#E0A94E] tracking-tight">Avertissements de composition</span>
            </div>
            {warnings.map((w, i) => (
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

        {/* ── Hint "premier tour vide" ── */}
        {!isReadonly && totalFilled === 0 && wonPlayers.length === 0 && (
          <div className="text-center py-4 px-4">
            <p className="font-serif italic text-[17px] text-paper mb-1.5">Constituez votre équipe</p>
            <p className="text-[12px] text-muted leading-relaxed">13 joueurs · {budget} points · mises fermées.<br />Ajoutez vos joueurs ligne par ligne ci-dessus.</p>
          </div>
        )}

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
      {!isWinter && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#16160F] border-t border-[#2A2824] px-4 py-3">
          {isReadonly ? (
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
                {warnings.length > 0 ? (
                  <>
                    <span className="text-[12px]">⚠️</span>
                    <span className="text-[11px] text-[#E0A94E] font-semibold">Mise non conforme — soumission autorisée</span>
                  </>
                ) : isConform ? (
                  <>
                    <span className="w-4 h-4 rounded-full bg-vert/20 border border-vert flex items-center justify-center text-[9px] text-[#3FB873]">✓</span>
                    <span className="text-[11px] text-[#3FB873] font-semibold">Composition conforme · 13 / 13 joueurs</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-muted" />
                    <span className="text-[11px] text-[#9C978B] font-semibold">{totalFilled} / 13 joueurs · complétez votre mise</span>
                  </>
                )}
              </div>
              {/* Bouton soumettre */}
              <button
                onClick={submitBids}
                disabled={submitting || draftBids.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gold text-night font-bold text-[14.5px] rounded-xl hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Soumettre ma mise
              </button>
              <div className="text-center text-[10px] text-muted italic">Remplace toute mise précédente de ce tour.</div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
