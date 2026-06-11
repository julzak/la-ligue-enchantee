"use client";

// Console d'administration des enchères d'été (BRIEF-05).
// Contrat de design : design_handoff/encheres/AdminConsole.dc.html
// (4 états : tour ouvert → clôturé → dépouillé → clôture de phase).
// Le récap copiable par participant appartient au BRIEF-06 : seule sa
// zone (emplacement + état) est posée ici, pas sa logique.

import { useState, useEffect, useCallback } from "react";
import { Gavel, Loader2, Clock, AlertTriangle, Check } from "lucide-react";

interface AuctionData {
  id: number;
  leagueId: number;
  status: string; // open | closed | tallied | resolved
  currentRound: number;
  budget: number;
  playersPerUser: number;
  roundDeadline: string | null; // ISO 8601
  phaseClosed: boolean;
}

interface Bid {
  userId: number;
  playerId: number;
  playerName: string;
  clubName: string;
  amount: number;
  status: string;
}

interface Proposal {
  playerId: number;
  name: string;
  line: string;
}

interface Participant {
  userId: number;
  userName: string;
  budget: number;
  playersWon: number;
  playersNeeded: number;
  hasSubmitted: boolean;
  rosterValid: boolean;
  rosterErrors: string[];
  missingCount: number;
  missingLines: string;
  proposals: Proposal[];
}

interface RoundResults {
  removals: { userId: number; playerId: number; playerName: string; amount: number; reason: string }[];
  ties: { playerId: number; playerName: string; amount: number; userIds: number[] }[];
}

interface League {
  id: number;
  dbId: number;
  name: string;
}

type Mode = "none" | "open" | "closed" | "tallied" | "phase-close" | "done";

/** Convertit un DateTime ISO en valeur compatible avec <input type="datetime-local"> */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const LINE_LABEL: Record<string, string> = { GK: "G", DEF: "DEF", MID: "MIL", ATT: "ATT" };

export default function AdminEncheresPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState(0);
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [results, setResults] = useState<RoundResults | null>(null);
  const [seasonLabel, setSeasonLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // M1 : actionPending désactive tous les boutons d'action pendant une requête
  // en cours pour empêcher un double-clic de déclencher un double-dépouillement.
  const [actionPending, setActionPending] = useState(false);
  const [message, setMessage] = useState("");
  const [phaseCloseView, setPhaseCloseView] = useState(false);

  // Butoir
  const [deadlineInput, setDeadlineInput] = useState("");
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);

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
        setResults(data.results ?? null);
        setSeasonLabel(data.seasonLabel ?? null);
        setDeadlineInput(data.auction?.roundDeadline ? isoToDatetimeLocal(data.auction.roundDeadline) : "");
        setEditingDeadline(false);
      }
    } catch {
      // N12-fix : message explicite avec invitation à recharger
      setMessage("Impossible de charger les données de l'enchère. Vérifiez votre connexion puis rechargez la page (F5).");
    }
    setLoading(false);
  }, [selectedLeague]);

  useEffect(() => { fetchAuction(); setPhaseCloseView(false); }, [fetchAuction]);

  async function handleAction(action: string, extraBody?: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    if (actionPending) return; // M1 : ignorer double-clic
    setActionPending(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, leagueId: selectedLeague, ...extraBody }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "OK");
      if (action === "close-phase" && data.ok) setPhaseCloseView(false);
      fetchAuction();
    } catch {
      setMessage("Erreur");
    } finally {
      setActionPending(false);
    }
  }

  async function handleSetDeadline() {
    setDeadlineLoading(true);
    setMessage("");
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

  // ── État courant ──────────────────────────────────────────────────────────
  const mode: Mode = !auction
    ? "none"
    : auction.status === "resolved"
      ? "done"
      : auction.status === "open"
        ? "open"
        : auction.status === "closed"
          ? "closed"
          : phaseCloseView
            ? "phase-close"
            : "tallied";

  const submitted = participants.filter((p) => p.hasSubmitted);
  const missing = participants.filter((p) => !p.hasSubmitted);
  const subPct = participants.length > 0 ? Math.round((submitted.length / participants.length) * 100) : 0;
  const incomplete = participants.filter((p) => !p.rosterValid);

  const chip =
    mode === "open" ? { label: "OUVERT", cls: "bg-vert/15 border-vert/40 text-emerald-400" } :
    mode === "closed" ? { label: "CLÔTURÉ", cls: "bg-rouge/10 border-rouge/40 text-rouge" } :
    mode === "tallied" ? { label: "DÉPOUILLÉ", cls: "bg-gold/15 border-gold/40 text-gold" } :
    mode === "phase-close" ? { label: "CLÔTURE DE PHASE", cls: "bg-amber-500/10 border-amber-500/30 text-amber-400" } :
    mode === "done" ? { label: "PHASE CLOSE", cls: "bg-muted/20 border-white/10 text-muted" } :
    null;

  const deadlineLabel = auction?.roundDeadline
    ? new Date(auction.roundDeadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : "Clôture manuelle";

  // ── Cycle de vie (stepper, fidèle à la maquette AdminConsole) ────────────
  type StepStatus = "done" | "active" | "next" | "loop" | "disabled";
  const stepStatuses: StepStatus[] =
    mode === "none" ? ["next", "disabled", "disabled", "disabled"] :
    mode === "open" ? ["active", "next", "disabled", "disabled"] :
    mode === "closed" ? ["done", "done", "next", "disabled"] :
    mode === "tallied" ? ["loop", "done", "done", "next"] :
    mode === "phase-close" ? ["done", "done", "done", "active"] :
    ["done", "done", "done", "done"];

  const steps = [
    {
      label: "Ouvrir un tour",
      sub:
        stepStatuses[0] === "active" ? "Tour ouvert — saisie en cours" :
        stepStatuses[0] === "loop" ? "Tour dépouillé — relancez un tour" :
        stepStatuses[0] === "next" ? "Démarre la phase d'enchères" : "Tour ouvert",
      cta: mode === "none" ? "Démarrer les enchères" : `Ouvrir le tour ${(auction?.currentRound ?? 0) + 1}`,
      destructive: false,
      onClick: () =>
        handleAction("open", {}, mode === "none" ? "Démarrer les enchères (tour 1) ?" : "Ouvrir le tour suivant ?"),
    },
    {
      label: "Clôturer le tour",
      sub:
        stepStatuses[1] === "next" ? "Verrouille les soumissions" :
        stepStatuses[1] === "done" ? "Soumissions verrouillées" : "Étape verrouillée",
      cta: "Clôturer le tour",
      destructive: false,
      onClick: () => handleAction("close-round", {}, "Clôturer le tour ? Les soumissions seront verrouillées."),
    },
    {
      label: "Dépouiller",
      sub:
        stepStatuses[2] === "next" ? "Calcule les attributions" :
        stepStatuses[2] === "done" ? "Attributions calculées" : "Étape verrouillée",
      cta: "Lancer le dépouillement",
      destructive: true,
      onClick: () =>
        handleAction("resolve-round", {}, "Lancer le dépouillement ? Le calcul des attributions est irréversible."),
    },
    {
      label: "Clore la phase",
      sub:
        stepStatuses[3] === "next" ? "Constitue les effectifs définitifs" :
        stepStatuses[3] === "active" ? "Constitution en cours" :
        stepStatuses[3] === "done" ? "Effectifs constitués" : "Disponible après dépouillement",
      cta: "Clore la phase",
      destructive: true,
      onClick: () => setPhaseCloseView(true),
    },
  ].map((s, i) => ({ ...s, status: stepStatuses[i], num: i + 1 }));

  // Acquisitions du tour courant par participant (statut won des bids du tour)
  const acquisitionsByUser = new Map<number, Bid[]>();
  for (const b of bids) {
    if (b.status !== "won") continue;
    const arr = acquisitionsByUser.get(b.userId) ?? [];
    arr.push(b);
    acquisitionsByUser.set(b.userId, arr);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Gavel className="w-6 h-6 text-gold" />
          Console des enchères
        </h1>
        <p className="text-sm text-muted">Pilotage d&apos;un tour de bout en bout : ouvrir, clôturer, dépouiller, clore la phase</p>
      </div>

      {/* Sélecteur de ligue (adaptation : la maquette est mono-ligue) */}
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
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") || message.includes("refus") || message.includes("invalide") || message.includes("Pas de") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-emerald-400"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : selectedLeague > 0 && (
        <>
          {/* ── BANDEAU D'ÉTAT ──────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-6 bg-surface border border-white/[0.07] rounded-lg p-5">
            <div className="flex-1 lg:border-r lg:border-white/[0.07] lg:pr-6">
              <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-2">Phase en cours</div>
              <div className="font-serif font-bold text-xl text-paper mb-1">
                Enchères d&apos;été{seasonLabel ? ` ${seasonLabel}` : ""}
              </div>
              <div className="flex items-center gap-3.5 mt-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">Tour courant</span>
                  <span className="text-[13px] font-bold text-gold">
                    {auction ? `Tour ${auction.currentRound}` : "—"}
                  </span>
                </div>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">Butoir</span>
                  <span className="text-[13px] font-medium text-paper-dim">{auction ? deadlineLabel : "—"}</span>
                </div>
                {chip && (
                  <span className={`text-[10.5px] font-bold tracking-[.5px] px-2.5 py-1 rounded-full border ${chip.cls}`}>
                    {chip.label}
                  </span>
                )}
              </div>
            </div>
            <div className="w-full lg:w-[380px] shrink-0">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase">Soumissions reçues</span>
                <span className="text-[13px] font-bold text-paper-dim">
                  <span className="text-gold text-lg tabular-nums">{submitted.length}</span> / {participants.length}
                </span>
              </div>
              <div className="h-[7px] rounded bg-surface-2 overflow-hidden mb-2.5">
                <div className="h-full rounded bg-gold" style={{ width: `${subPct}%` }} />
              </div>
              {(mode === "open" || mode === "closed") && missing.length > 0 && (
                <>
                  <div className="text-[10.5px] text-muted mb-1.5">En attente · {missing.length}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((p) => (
                      <span key={p.userId} className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                        {p.userName}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {(mode === "open" || mode === "closed") && missing.length === 0 && participants.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <Check className="w-3.5 h-3.5" /> Toutes les soumissions sont arrivées
                </div>
              )}
            </div>
          </div>

          {/* ── GRILLE PRINCIPALE : stepper + contenu d'état ───────────── */}
          <div className="grid gap-6 lg:grid-cols-[312px_1fr] items-start">

            {/* Cycle de vie du tour */}
            <div className="bg-surface border border-white/[0.07] rounded-lg p-5">
              <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-4">Cycle de vie du tour</div>
              <div className="flex flex-col">
                {steps.map((s, idx) => (
                  <div key={s.num} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      {s.status === "done" ? (
                        <div className="w-[26px] h-[26px] rounded-full bg-vert/20 border border-vert flex items-center justify-center text-emerald-400">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : s.status === "active" ? (
                        <div className="w-[26px] h-[26px] rounded-full bg-gold/15 border border-gold flex items-center justify-center text-[11px] font-bold text-gold">{s.num}</div>
                      ) : s.status === "next" || s.status === "loop" ? (
                        <div className="w-[26px] h-[26px] rounded-full bg-gold flex items-center justify-center text-[11px] font-extrabold text-night">{s.num}</div>
                      ) : (
                        <div className="w-[26px] h-[26px] rounded-full bg-surface-2 border border-white/10 flex items-center justify-center text-[11px] font-bold text-muted">{s.num}</div>
                      )}
                      {idx < steps.length - 1 && <div className="w-px flex-1 min-h-[24px] bg-white/10 my-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className={`text-[13.5px] font-bold ${s.status === "disabled" ? "text-muted" : "text-paper"}`}>{s.label}</div>
                      <div className="text-[11px] text-muted leading-snug mt-0.5">{s.sub}</div>

                      {/* Butoir éditable, uniquement étape 1 quand le tour est ouvert */}
                      {s.num === 1 && mode === "open" && (
                        <div className="mt-2.5 bg-night border border-white/10 rounded p-2.5">
                          <div className="text-[9.5px] font-bold tracking-[.8px] text-muted uppercase mb-1.5">Butoir (optionnel)</div>
                          {editingDeadline ? (
                            <div className="flex flex-col gap-2">
                              <input
                                type="datetime-local"
                                value={deadlineInput}
                                onChange={(e) => setDeadlineInput(e.target.value)}
                                className="bg-surface-2 border border-white/[0.07] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                              />
                              <button
                                onClick={handleSetDeadline}
                                disabled={deadlineLoading}
                                className="h-7 px-2.5 bg-gold text-night rounded text-[11px] font-semibold hover:bg-gold/80 disabled:opacity-50 flex items-center justify-center gap-1.5"
                              >
                                {deadlineLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                                {deadlineInput ? "Enregistrer" : "Effacer le butoir"}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-semibold text-paper-dim tabular-nums">{deadlineLabel}</span>
                              <button onClick={() => setEditingDeadline(true)} className="text-[11px] text-gold font-semibold hover:underline">
                                Modifier
                              </button>
                            </div>
                          )}
                          <div className="text-[10px] text-muted mt-1.5 italic">Modifiable tant que le tour est ouvert. Tolérance 0 (timestamp serveur).</div>
                        </div>
                      )}

                      {(s.status === "next" || s.status === "loop") && (
                        <>
                          <button
                            onClick={s.onClick}
                            disabled={actionPending}
                            className={`mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 rounded text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed ${
                              s.destructive
                                ? "bg-rouge/15 border border-rouge/50 text-rouge hover:bg-rouge/25"
                                : "bg-gold text-night hover:bg-gold/80"
                            }`}
                          >
                            {actionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            {s.cta}
                          </button>
                          {s.destructive && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="text-[10.5px] text-amber-400 leading-tight">Action irréversible — confirmation requise.</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contenu d'état */}
            <div className="flex flex-col gap-5">

              {/* AUCUNE ENCHÈRE */}
              {mode === "none" && (
                <div className="bg-surface border border-white/[0.07] rounded-lg p-6 text-sm text-muted">
                  Aucune enchère d&apos;été pour cette ligue. Démarrez les enchères depuis le panneau de gauche.
                </div>
              )}

              {/* TOUR OUVERT : soumissions en direct */}
              {mode === "open" && (
                <div className="bg-surface border border-white/[0.07] rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                    <span className="text-[15px] font-bold text-paper">Soumissions en cours</span>
                    <span className="text-xs text-muted">Mises fermées jusqu&apos;au dépouillement</span>
                  </div>
                  <div className="grid sm:grid-cols-2">
                    {participants.map((p) => (
                      <div key={p.userId} className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.04]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-surface-2 border border-white/10 flex items-center justify-center text-[10px] font-bold text-paper-dim/70">
                            {initials(p.userName)}
                          </div>
                          <span className="text-[13px] text-paper-dim">{p.userName}</span>
                        </div>
                        {p.hasSubmitted ? (
                          <span className="text-[10px] font-bold tracking-[.4px] px-2 py-0.5 rounded-full bg-vert/15 border border-vert/40 text-emerald-400">SOUMISE</span>
                        ) : (
                          <span className="text-[10px] font-bold tracking-[.4px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 whitespace-nowrap">EN ATTENTE</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TOUR CLÔTURÉ : prêt à dépouiller */}
              {mode === "closed" && auction && (
                <div className="bg-surface border border-white/[0.07] rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-[10px] font-bold tracking-[.5px] px-2.5 py-1 rounded-full bg-rouge/10 border border-rouge/40 text-rouge">TOUR CLÔTURÉ</span>
                    <span className="text-[13px] text-muted">Soumissions verrouillées · plus aucune modification possible</span>
                  </div>
                  <div className="font-serif font-bold text-2xl text-paper mb-4">Prêt à dépouiller le tour {auction.currentRound}</div>
                  <div className="flex flex-col sm:flex-row gap-3.5 mb-5">
                    <div className="flex-1 bg-night border border-white/[0.07] rounded-lg px-4 py-3.5">
                      <div className="text-3xl font-extrabold text-gold tabular-nums leading-none">{submitted.length} / {participants.length}</div>
                      <div className="text-[11.5px] text-muted mt-1.5">soumissions enregistrées</div>
                    </div>
                    {missing.length > 0 && (
                      <div className="flex-[2] bg-amber-500/5 border border-amber-500/30 rounded-lg px-4 py-3.5">
                        <div className="text-[12.5px] font-bold text-amber-400 mb-1">{missing.length} participant(s) sans soumission</div>
                        <div className="text-[11.5px] text-muted leading-relaxed">
                          {missing.map((p) => p.userName).join(", ")} — seront traités selon le règlement au dépouillement (aucune acquisition, budget conservé).
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted italic">Lancez le dépouillement depuis le panneau de gauche. Le calcul des attributions est irréversible.</div>
                </div>
              )}

              {/* DÉPOUILLÉ : résultats + zone récap (logique BRIEF-06) */}
              {mode === "tallied" && auction && (
                <>
                  <div className="bg-surface border border-white/[0.07] rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.07]">
                      <span className="text-[15px] font-bold text-paper">Résultats du dépouillement · Tour {auction.currentRound}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr_1fr_90px] gap-0 text-[10px] font-bold tracking-[.8px] text-muted uppercase px-5 py-2.5 border-b border-white/[0.07] bg-night">
                      <span>Participant</span><span>Acquisitions</span><span>Retraits · égalités</span><span className="text-right">Budget</span>
                    </div>
                    {participants.map((p) => {
                      const acqs = acquisitionsByUser.get(p.userId) ?? [];
                      const removals = results?.removals.filter((r) => r.userId === p.userId) ?? [];
                      const ties = results?.ties.filter((t) => t.userIds.includes(p.userId)) ?? [];
                      return (
                        <div key={p.userId} className="grid grid-cols-[140px_1fr_1fr_90px] gap-0 items-center px-5 py-3 border-b border-white/[0.04]">
                          <span className="text-[13px] font-bold text-paper-dim">{p.userName}</span>
                          <div className="flex flex-wrap gap-1.5 pr-3">
                            {acqs.map((a) => (
                              <span key={a.playerId} className="text-[11px] text-paper-dim bg-gold/[0.08] border border-gold/25 rounded px-2 py-0.5">
                                {a.playerName} <span className="text-gold font-bold">{a.amount}</span>
                              </span>
                            ))}
                            {acqs.length === 0 && <span className="text-[11.5px] text-muted italic">aucune</span>}
                          </div>
                          <div className="text-[11.5px] text-muted leading-snug pr-3">
                            {removals.map((r) => (
                              <div key={`${r.playerId}-rm`}>{r.reason}</div>
                            ))}
                            {ties.map((t) => (
                              <div key={`${t.playerId}-tie`}>Égalité ({t.amount} pts) : {t.playerName} remis en jeu au tour suivant.</div>
                            ))}
                            {!p.hasSubmitted && <div>Aucune soumission — budget conservé.</div>}
                            {removals.length === 0 && ties.length === 0 && p.hasSubmitted && <span>—</span>}
                          </div>
                          <span className="text-sm font-bold text-gold text-right tabular-nums">{p.budget} pts</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Zone récap copiable — la logique appartient au BRIEF-06 */}
                  <div className="bg-surface border border-white/[0.07] rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                      <div>
                        <div className="text-[15px] font-bold text-paper">Récap copiable</div>
                        <div className="text-[11.5px] text-muted mt-0.5">
                          L&apos;email de notification est envoyé <span className="text-amber-400 font-semibold">manuellement</span> par les modérateurs.
                        </div>
                      </div>
                      <button disabled className="text-[12.5px] font-bold text-night bg-gold rounded px-4 py-2 opacity-40 cursor-not-allowed">
                        Tout copier
                      </button>
                    </div>
                    <div className="px-5 py-6 text-[12.5px] text-muted italic">
                      Le récap par participant arrive avec le chantier Résultats (BRIEF-06).
                    </div>
                  </div>
                </>
              )}

              {/* CLÔTURE DE PHASE : complétion d'office */}
              {mode === "phase-close" && (
                <div className="bg-surface border border-white/[0.07] rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold tracking-[.5px] px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">CLÔTURE DE PHASE</span>
                    <button onClick={() => setPhaseCloseView(false)} className="text-[11px] text-muted hover:text-paper-dim">
                      ← Revenir aux résultats
                    </button>
                  </div>
                  <div className="font-serif font-bold text-xl text-paper mb-1.5">Complétion d&apos;office des effectifs</div>
                  {incomplete.length > 0 ? (
                    <div className="text-[13px] text-muted leading-relaxed mb-5 max-w-3xl">
                      {incomplete.length} participant(s) ont un effectif incomplet ou invalide. Les emplacements manquants sont complétés d&apos;office à{" "}
                      <span className="text-gold font-bold">1 point</span> parmi les joueurs encore disponibles, avant de clore la phase.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[13px] text-emerald-400 font-semibold mb-5">
                      <Check className="w-4 h-4" /> Tous les effectifs sont complets (13 joueurs valides).
                    </div>
                  )}

                  <div className="flex flex-col gap-3.5">
                    {incomplete.map((p) => (
                      <div key={p.userId} className="bg-night border border-white/[0.07] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-sm font-bold text-paper-dim">{p.userName}</span>
                            <span className="text-[11.5px] font-bold text-rouge bg-rouge/10 border border-rouge/35 rounded px-2 py-0.5 tabular-nums">
                              {p.playersWon} / {auction?.playersPerUser ?? 13}
                            </span>
                            {p.missingCount > 0 && (
                              <span className="text-[11.5px] text-muted">
                                manque {p.missingCount} joueur(s){p.missingLines ? ` · ${p.missingLines}` : ""}
                              </span>
                            )}
                            {p.missingCount === 0 && p.rosterErrors.length > 0 && (
                              <span className="text-[11.5px] text-rouge">{p.rosterErrors.join(" ; ")}</span>
                            )}
                          </div>
                          {p.proposals.length > 0 && (
                            <button
                              onClick={() =>
                                handleAction(
                                  "complete-roster",
                                  { userId: p.userId, playerIds: p.proposals.map((pr) => pr.playerId) },
                                  `Compléter d'office l'effectif de ${p.userName} avec ${p.proposals.length} joueur(s) à 1 pt ?`
                                )
                              }
                              disabled={actionPending}
                              className="text-[12.5px] font-bold text-night bg-gold rounded px-3.5 py-2 hover:bg-gold/80 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Compléter à 1 pt
                            </button>
                          )}
                        </div>
                        {p.proposals.length > 0 ? (
                          <>
                            <div className="text-[10.5px] font-bold tracking-[.6px] text-muted uppercase mb-1.5">Joueurs disponibles proposés</div>
                            <div className="flex flex-wrap gap-1.5">
                              {p.proposals.map((pr) => (
                                <span key={pr.playerId} className="text-[11.5px] text-paper-dim bg-gold/[0.07] border border-gold/25 rounded px-2 py-1">
                                  {pr.name} <span className="text-[9.5px] text-muted">{LINE_LABEL[pr.line] ?? pr.line}</span>{" "}
                                  <span className="text-gold font-bold">1 pt</span>
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          p.missingCount > 0 && (
                            <div className="text-[11.5px] text-rouge">
                              Aucune complétion possible dans les quotas avec les joueurs disponibles.
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.07] flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-400">Clore la phase verrouille tous les effectifs définitivement. Action irréversible.</span>
                    </div>
                    <button
                      onClick={() =>
                        handleAction("close-phase", {}, "Clore la phase et constituer les effectifs ? Action irréversible.")
                      }
                      disabled={incomplete.length > 0 || actionPending}
                      className="text-[13.5px] font-bold text-night bg-gold rounded-lg px-5 py-3 hover:bg-gold/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {actionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Clore la phase et constituer les effectifs
                    </button>
                  </div>
                </div>
              )}

              {/* PHASE CLOSE (terminal) */}
              {mode === "done" && (
                <div className="bg-surface border border-white/[0.07] rounded-lg p-6">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-[10px] font-bold tracking-[.5px] px-2.5 py-1 rounded-full bg-vert/15 border border-vert/40 text-emerald-400">PHASE CLOSE</span>
                  </div>
                  <div className="font-serif font-bold text-2xl text-paper mb-2">Les effectifs sont constitués</div>
                  <p className="text-[13px] text-muted leading-relaxed max-w-2xl">
                    Les 13 joueurs de chaque participant ont été écrits dans les effectifs de la saison.
                    Les équipes sont consultables sur les pages habituelles (Mon équipe, admin Équipes) et le scoring
                    des journées s&apos;appuiera dessus. Pour relancer une phase d&apos;enchères, démarrez une nouvelle enchère.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {participants.map((p) => (
                      <div key={p.userId} className="bg-night border border-white/[0.07] rounded px-4 py-3">
                        <span className="text-sm text-paper-dim font-medium">{p.userName}</span>
                        <div className="flex justify-between mt-1 text-xs text-muted">
                          <span>{p.budget} pts restants</span>
                          <span>{p.playersWon}/{auction?.playersPerUser ?? 13} joueurs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
