"use client";

/**
 * Section Résultats du tour — Vue participant (BRIEF-06)
 * Contrat de design : design_handoff/encheres/ResultScreen.dc.html
 *
 * Écarts maquette documentés dans la PR :
 *   - Horodatage clôture (finding N5) : affiché si round_deadline renseignée,
 *     absent sinon (pas de colonne created_at sur AUCTION_BID, choix documenté).
 *   - Sélecteur de tour intégré au header (maquette : pills horizontales).
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Trophy, AlertCircle } from "lucide-react";
import { lineFromPosition } from "@/lib/auction-resolution";

// ── Types ──────────────────────────────────────────────────────────────────

interface RoundAcquisition {
  playerName: string;
  position: string;
  clubName: string;
  amount: number;
}

interface RoundLoss {
  playerName: string;
  position: string;
  yourBid: number;
  reasonType: "surenchere" | "tie" | "lost";
  detail: string;
  refund?: number;
}

interface RoundRemoval {
  playerName: string;
  amount: number;
  reason: string;
}

interface ParticipantResult {
  userId: number;
  userName: string;
  isYou: boolean;
  acquisitions: RoundAcquisition[];
  total: number;
}

interface ResultsData {
  auctionId: number;
  auctionStatus: string;
  currentRound: number;
  roundDeadline: string | null;
  resolvedRounds: number[];
  selectedRound: number | null;
  budgetPerUser: number;
  playersPerUser: number;
  budgetRemaining: number;
  playersWon: number;
  myAcquisitions: RoundAcquisition[];
  myLosses: RoundLoss[];
  myRemovals: RoundRemoval[];
  myPendingBids: { playerName: string; position: string; clubName: string; amount: number }[];
  allResults: ParticipantResult[] | null;
  /** Grand déballage : toutes les mises de tous les tours, servi par l'API
      uniquement quand la phase est terminée (décision 2026-08-10). */
  fullDisclosure:
    | {
        round: number;
        bids: {
          userName: string; playerName: string; position: string;
          clubName: string; amount: number; status: string;
        }[];
      }[]
    | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Délégué au mapping canonique du moteur : la copie locale ne reconnaissait
// pas "Défense" (format réel de la base) et son fallback était "ATT".
function positionLabel(pos: string): string {
  const line = lineFromPosition(pos);
  if (line === "GK") return "G";
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

// Note : l'API résultats retourne uniquement les acquisitions du tour sélectionné,
// pas l'effectif complet par ligne. Le compteur X/13 est fiable (somme de tous les
// tours via playersWon), mais le détail par ligne dans la barre de progression
// ne reflète que le tour sélectionné. Limitation documentée dans la PR.

// ── Composant principal ────────────────────────────────────────────────────

export function ResultsSection({ leagueDbId }: { leagueDbId: number }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResultsData | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const fetchResults = useCallback(async (round?: number) => {
    if (!leagueDbId) return;
    setLoading(true);
    try {
      const qs = round ? `&round=${round}` : "";
      const res = await fetch(`/api/auction/results?leagueId=${leagueDbId}${qs}`);
      const json = await res.json();
      if (json.auction === null) {
        setData(null);
      } else {
        setData(json);
        setSelectedRound(json.selectedRound ?? null);
      }
    } catch {
      // erreur réseau silencieuse : l'état loading=false suffit
    }
    setLoading(false);
  }, [leagueDbId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-muted text-sm">Aucune enchère pour cette ligue.</p>
      </div>
    );
  }

  // ── État sans aucun tour dépouillé ────────────────────────────────────────

  if (data.resolvedRounds.length === 0) {
    // Awaiting : tour fermé mais pas encore dépouillé
    const isClosedAwaiting = data.auctionStatus === "closed" || data.auctionStatus === "tallied";
    const deadlineLabel = data.roundDeadline
      ? new Date(data.roundDeadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
      : null;

    return (
      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5">
        {isClosedAwaiting ? (
          <div className="text-center py-10 px-4">
            <div className="text-4xl mb-4">⏳</div>
            <div className="font-serif italic text-[21px] font-semibold text-paper mb-2">
              Dépouillement en attente
            </div>
            <div className="text-[13px] text-[#A39E92] leading-relaxed max-w-[290px] mx-auto">
              {deadlineLabel
                ? `Tour clôturé le ${deadlineLabel}. Les résultats seront disponibles après le dépouillement.`
                : "Ce tour est clôturé. Les résultats seront disponibles après le dépouillement par l'administrateur."}
            </div>
            {data.myPendingBids.length > 0 && (
              <div className="mt-5 bg-[#1B1B19] border border-[#272521] rounded-xl p-4 text-left">
                <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-3">
                  Votre mise enregistrée
                </div>
                <div className="text-[13.5px] font-semibold text-[#D8D3C7]">
                  {data.myPendingBids.length} joueurs · {data.myPendingBids.reduce((s, b) => s + b.amount, 0)} pts engagés
                </div>
              </div>
            )}
            <div className="mt-4 text-[11.5px] text-[#7C776C] italic">
              Le dépouillement de tous apparaîtra ici une fois publié.
            </div>
          </div>
        ) : (
          <div className="text-center py-10 px-4">
            <div className="font-serif italic text-[18px] text-paper mb-2">
              Aucun résultat pour l&apos;instant
            </div>
            <div className="text-[13px] text-muted leading-relaxed max-w-[280px] mx-auto">
              Les résultats de chaque tour apparaîtront ici après le dépouillement.
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Fin de phase (resolved) : effectif 13/13 célébré ─────────────────────

  if (data.auctionStatus === "resolved" && data.playersWon >= data.playersPerUser) {
    const totalSpent = data.budgetPerUser - data.budgetRemaining;

    return (
      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5">
        {/* Célébration */}
        <div className="text-center py-8 px-4">
          <div className="flex justify-center gap-2 text-gold text-xl mb-4" style={{ textShadow: "0 0 12px rgba(200,168,75,.45)" }}>
            ★ ★ ★
          </div>
          <div className="font-serif font-bold text-[25px] text-paper leading-[1.15] mb-3">
            Votre effectif est<br />au complet
          </div>
          <div className="text-[13px] text-[#A39E92] leading-relaxed max-w-[300px] mx-auto">
            Vos {data.playersPerUser} joueurs sont verrouillés pour la saison. Que le meilleur gagne.
          </div>
        </div>

        {/* Carte effectif final — style "papier journal" */}
        <div className="bg-[#F5F2EB] rounded-xl px-4 pt-4 pb-5 shadow-[0_14px_34px_rgba(0,0,0,.4)]">
          <div className="flex items-baseline justify-between border-b-[1.5px] border-[#1A1A18] pb-2 mb-3">
            <span className="font-serif font-bold text-[18px] text-[#1A1A18]">Votre équipe</span>
            <span className="font-serif italic text-[13px] text-[#7A6A2E]">2025 – 2026</span>
          </div>
          {/* Sélecteur de tour pour voir les résultats tour par tour */}
          <div className="flex gap-2 flex-wrap mt-1 mb-4">
            {data.resolvedRounds.map((r) => (
              <button
                key={r}
                onClick={() => { setSelectedRound(r); fetchResults(r); }}
                className={`text-[11.5px] font-semibold px-3 py-1 rounded-full border transition-colors ${
                  selectedRound === r
                    ? "bg-[#C8A84B] text-[#16160F] border-[#C8A84B]"
                    : "text-[#8A8270] border-[#C8A84B]/30 hover:border-[#C8A84B]/60"
                }`}
              >
                T{r}
              </button>
            ))}
          </div>
          <div className="flex items-baseline justify-between border-t-[1.5px] border-[#1A1A18] pt-2 mt-2">
            <span className="text-[12px] font-bold text-[#1A1A18] uppercase tracking-wide">Total engagé</span>
            <span className="font-serif font-bold text-[20px] text-[#1A1A18]">
              {totalSpent} <span className="text-[12px] text-[#8A8270]">/ {data.budgetPerUser} pts</span>
            </span>
          </div>
        </div>

        <p className="text-center text-[12px] text-[#9C978B] italic">
          La phase d&apos;enchères est terminée. Rendez-vous sur le terrain.
        </p>
      </div>
    );
  }

  // ── Vue principale : tour dépouillé ───────────────────────────────────────

  const isPhaseOver = data.auctionStatus === "resolved";

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">

      {/* ── HEADER : titre + sélecteur de tour ── */}
      <div className="pb-4 border-b border-[#232220] bg-gradient-to-b from-[#16160F] to-[#141414] -mx-4 px-4 pt-2">
        <div className="font-serif font-bold text-[22px] text-paper leading-none mb-1">Résultats</div>
        {data.resolvedRounds.length > 0 && (
          <>
            <div className="text-[11.5px] text-muted mb-3">
              {isPhaseOver
                ? "Phase close · effectifs constitués"
                : `Tour ${data.currentRound} · dépouillement disponible`}
            </div>
            <div className="flex gap-2 flex-wrap">
              {data.resolvedRounds.map((r) => (
                <button
                  key={r}
                  onClick={() => { setSelectedRound(r); fetchResults(r); }}
                  className={`text-[12.5px] font-bold px-3.5 py-1.5 rounded-full transition-colors ${
                    selectedRound === r
                      ? "bg-gold text-night"
                      : "bg-gold/[0.08] border border-gold/30 text-[#C9B97E] hover:bg-gold/[0.14]"
                  }`}
                >
                  T{r}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── MES ACQUISITIONS ── */}
      {data.myAcquisitions.length > 0 ? (
        <div>
          <div className="font-serif italic font-semibold text-[18px] text-[#D8BC63] mb-3 px-0.5">
            {data.myAcquisitions.length === 1
              ? "Vous remportez 1 joueur ce tour."
              : `Vous remportez ${data.myAcquisitions.length} joueurs ce tour.`}
          </div>
          <div className="bg-gradient-to-b from-gold/[0.10] to-gold/[0.03] border border-gold/[0.34] rounded-xl overflow-hidden">
            <div className="text-[10.5px] font-bold tracking-[1.4px] text-[#C9B97E] uppercase px-4 py-3">
              Mes acquisitions
            </div>
            {data.myAcquisitions.map((a) => (
              <div key={a.playerName} className="flex items-center gap-3 px-4 py-3 border-t border-gold/[0.16]">
                <div className="w-[38px] h-[38px] flex-none rounded-full bg-[#2C2A22] border border-gold/40 flex items-center justify-center text-[12px] font-bold text-[#D8BC63]">
                  {initials(a.playerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-paper truncate">{a.playerName}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-muted">{a.clubName}</span>
                    <span className="text-[9.5px] font-bold px-1 py-px rounded bg-gold/[0.12] border border-gold/30 text-[#C9B97E] tracking-wider">
                      {positionLabel(a.position)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif font-bold text-[22px] text-gold leading-none">{a.amount}</div>
                  <div className="text-[9px] text-muted mt-0.5">pts payés</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#1B1B19] border border-[#272521] rounded-xl p-5 text-center">
          <div className="font-serif italic font-semibold text-[18px] text-paper mb-2">Tour blanc</div>
          <div className="text-[12.5px] text-[#A39E92] leading-relaxed">
            Rien d&apos;acquis ce tour, mais vos {data.budgetRemaining} pts restent intacts pour le tour suivant.
            Les meilleurs coups se jouent souvent plus tard.
          </div>
        </div>
      )}

      {/* ── MES MISES PERDUES ── */}
      {data.myLosses.length > 0 && (
        <div>
          <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-2 px-0.5">
            Mes mises perdues
          </div>
          <div className="flex flex-col gap-2">
            {data.myLosses.map((l, i) => (
              <div key={`${l.playerName}-${i}`} className="bg-[#191917] border border-[#272521] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13.5px] font-semibold text-[#B8B3A7] line-through decoration-[#5A564C] truncate">
                      {l.playerName}
                    </span>
                    <span className="text-[9.5px] font-bold px-1.5 py-px rounded bg-white/[0.04] border border-[#34322B] text-[#8C877C] shrink-0">
                      {positionLabel(l.position)}
                    </span>
                  </div>
                  <span className="text-[11.5px] text-[#7C776C] whitespace-nowrap shrink-0">misé {l.yourBid}</span>
                </div>
                {l.reasonType === "surenchere" ? (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-bold tracking-wider px-1.5 py-px rounded bg-rouge/[0.14] border border-rouge/40 text-[#E0705F]">
                      SURENCHÉRI
                    </span>
                    <span className="text-[11.5px] text-[#9C978B]">{l.detail}</span>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold tracking-wider px-1.5 py-px rounded bg-gold/[0.14] border border-gold/40 text-[#E0A94E]">
                        ÉGALITÉ
                      </span>
                      <span className="text-[11.5px] text-[#9C978B]">{l.detail}</span>
                    </div>
                    {l.refund !== undefined && (
                      <div className="text-[11px] text-[#3FB873] mt-1.5 font-semibold">
                        ↩ {l.refund} pts rendus à votre budget
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MES RETRAITS DE PÉNALITÉ ── */}
      {data.myRemovals.length > 0 && (
        <div>
          <div className="text-[10.5px] font-bold tracking-[1.4px] text-[#E0705F] uppercase mb-2 px-0.5">
            Retraits de pénalité
          </div>
          <div className="flex flex-col gap-2">
            {data.myRemovals.map((r, i) => (
              <div key={`${r.playerName}-${i}`} className="bg-rouge/[0.08] border border-rouge/[0.34] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[14px] font-semibold text-paper line-through decoration-rouge">
                    {r.playerName}
                  </span>
                  <span className="text-[9.5px] font-bold px-1.5 py-px rounded bg-rouge/[0.16] border border-rouge/40 text-[#E0705F]">
                    RETIRÉ
                  </span>
                </div>
                <div className="text-[12px] text-[#C9B7A8] leading-relaxed">{r.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BUDGET RESTANT + EFFECTIF ── */}
      <div className="flex gap-2.5">
        <div className="flex-[1.1] bg-[#16160F] border border-gold/[0.30] rounded-xl px-4 py-3">
          <div className="text-[9.5px] font-bold tracking-[1.2px] text-muted uppercase mb-1 leading-snug">
            Budget · {isPhaseOver ? "phase close" : `Tour ${(selectedRound ?? 1) + 1}`}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-extrabold text-gold leading-none tabular-nums tracking-tight">
              {data.budgetRemaining}
            </span>
            <span className="text-[12px] text-muted">pts</span>
          </div>
        </div>
        <div className="flex-1 bg-[#1B1B19] border border-[#272521] rounded-xl px-4 py-3">
          <div className="text-[9.5px] font-bold tracking-[1.2px] text-muted uppercase mb-1">Mon effectif</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[34px] font-extrabold text-paper leading-none tabular-nums tracking-tight">
              {data.playersWon}
            </span>
            <span className="text-[13px] text-muted">/ {data.playersPerUser}</span>
          </div>
        </div>
      </div>

      {/* Barre de progression effectif par ligne */}
      {(() => {
        const lineDefs = [
          { key: "G",   label: "Gardien",    max: 1 },
          { key: "DEF", label: "Défenseurs", max: 6 },
          { key: "MIL", label: "Milieux",    max: 6 },
          { key: "ATT", label: "Attaquants", max: 4 },
        ];
        // Note : on n'a pas le détail par ligne depuis l'API résultats (uniquement les acqs du tour sélectionné).
        // Limitation documentée dans la PR : le compteur par ligne utilise toutes les acquisitions,
        // mais elles ne sont chargées que pour le tour sélectionné. Affichage global X/13 fiable ;
        // le détail par ligne est approximé par les acquisitions du tour actif.
        const thisRoundByLine = new Map<string, number>();
        for (const a of data.myAcquisitions) {
          const pl = positionLabel(a.position);
          thisRoundByLine.set(pl, (thisRoundByLine.get(pl) ?? 0) + 1);
        }
        return (
          <div className="bg-[#191917] border border-[#232220] rounded-xl px-4 py-3 -mt-2">
            {lineDefs.map((ld) => {
              // On affiche uniquement le sous-total du tour sélectionné (approx)
              const got = thisRoundByLine.get(ld.key) ?? 0;
              const dots = Array.from({ length: ld.max }, (_, i) => i < got);
              return (
                <div key={ld.key} className="flex items-center gap-2.5 py-1">
                  <span className="text-[10.5px] font-bold text-[#9C978B] w-[78px] flex-none">{ld.label}</span>
                  <div className="flex-1 flex gap-1">
                    {dots.map((filled, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-[2px] ${filled ? "bg-gold" : "border border-[#3A382F]"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-[#7C776C] tabular-nums flex-none">
                    {got}/{ld.max}
                  </span>
                </div>
              );
            })}
            <div className="text-[10px] text-muted/60 italic mt-1">Acquisitions ce tour uniquement.</div>
          </div>
        );
      })()}

      {/* ── DÉPOUILLEMENT DE TOUS (transparence) ── */}
      {data.allResults && data.allResults.length > 0 && (
        <div>
          <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-2 px-0.5">
            Le dépouillement de tous
          </div>
          <div className="bg-[#F5F2EB] rounded-xl px-4 pt-4 pb-2 shadow-[0_12px_30px_rgba(0,0,0,.38)]">
            <div className="flex items-baseline justify-between border-b-[1.5px] border-[#1A1A18] pb-2 mb-1">
              <span className="font-serif font-bold text-[16px] text-[#1A1A18]">
                Dépouillement · Tour {selectedRound}
              </span>
              <span className="text-[10px] text-[#8A8270] italic">prix en points</span>
            </div>
            {data.allResults.map((p) => (
              <div key={p.userId} className="py-2.5 border-b border-[#DAD4C5] last:border-b-0">
                <div className="flex items-baseline justify-between">
                  {p.isYou ? (
                    <span className="font-serif font-bold text-[14px] text-[#7A6A2E]">{p.userName}</span>
                  ) : (
                    <span className="font-serif font-semibold text-[14px] text-[#1A1A18]">{p.userName}</span>
                  )}
                  <span className="text-[11px] font-bold text-[#5A564C] tabular-nums whitespace-nowrap pl-2 flex-none">
                    +{p.acquisitions.length} · {p.total} pts
                  </span>
                </div>
                {p.acquisitions.length > 0 ? (
                  <div className="text-[11.5px] text-[#4A463C] mt-0.5 leading-relaxed">
                    {p.acquisitions.map((a) => `${a.playerName} ${a.amount}`).join("  ·  ")}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#8A8270] italic mt-0.5">aucune acquisition ce tour</div>
                )}
              </div>
            ))}
            <div className="text-center text-[9.5px] text-[#8A8270] italic py-2">
              Visible uniquement après dépouillement · source des notes : L&apos;Équipe
            </div>
          </div>
        </div>
      )}

      {/* ── Grand déballage (phase terminée uniquement) ──
          Toutes les mises de tous les tours, groupées par joueur : qui a
          coiffé qui, et pour combien. Le serveur ne fournit ces données
          qu'une fois la phase clôturée. */}
      {data.fullDisclosure && data.fullDisclosure.length > 0 && (
        <div>
          <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-2 px-0.5">
            Le grand déballage · toutes les mises de la phase
          </div>
          <div className="bg-[#F5F2EB] rounded-xl px-4 pt-4 pb-2 shadow-[0_12px_30px_rgba(0,0,0,.38)] space-y-3">
            {data.fullDisclosure.map((r) => {
              const byPlayer = new Map<string, typeof r.bids>();
              for (const b of r.bids) {
                const arr = byPlayer.get(b.playerName) ?? [];
                arr.push(b);
                byPlayer.set(b.playerName, arr);
              }
              return (
                <div key={r.round}>
                  <div className="border-b-[1.5px] border-[#1A1A18] pb-1.5 mb-1">
                    <span className="font-serif font-bold text-[15px] text-[#1A1A18]">Tour {r.round}</span>
                  </div>
                  {Array.from(byPlayer.entries()).map(([playerName, bids]) => (
                    <div key={playerName} className="py-1.5 border-b border-[#DAD4C5] last:border-b-0">
                      <span className="text-[12px] font-semibold text-[#1A1A18]">{playerName}</span>
                      <span className="text-[11.5px] text-[#4A463C]">
                        {" — "}
                        {bids
                          .map((b) =>
                            b.status === "won"
                              ? `${b.userName} ${b.amount} ✓`
                              : b.status === "tie"
                                ? `${b.userName} ${b.amount} (égalité)`
                                : b.status === "removed"
                                  ? `${b.userName} ${b.amount} (retiré)`
                                  : `${b.userName} ${b.amount}`
                          )
                          .join("  ·  ")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="text-center text-[9.5px] text-[#8A8270] italic py-2">
              Archives complètes de la phase · ✓ = acquis
            </div>
          </div>
        </div>
      )}

      {/* ── Message d'état final ── */}
      {isPhaseOver && (
        <div className="flex items-center gap-2 px-3 py-3 bg-vert/[0.07] border border-vert/30 rounded-xl">
          <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[12.5px] text-[#3FB873] font-semibold">
            Phase d&apos;enchères terminée · effectif {data.playersWon}/{data.playersPerUser} constitué.
          </span>
        </div>
      )}

      {!isPhaseOver && data.playersWon < data.playersPerUser && (
        <div className="flex items-start gap-2 px-3 py-3 bg-gold/[0.06] border border-gold/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-gold/60 shrink-0 mt-0.5" />
          <span className="text-[12px] text-[#9C978B]">
            Il reste {data.playersPerUser - data.playersWon} joueur(s) à acquérir pour compléter votre effectif.
          </span>
        </div>
      )}

    </div>
  );
}
