"use client";

/**
 * Écran récap du mercato — /ligue/[slug]/mercato
 *
 * Vue agrégée de toutes les acquisitions des tours dépouillés, filtrable par
 * participant et par tour, avec sélecteur de phase (été / hiver) prêt pour le
 * mercato d'hiver. Lecture seule : les données viennent de
 * GET /api/auction/recap (acquisitions publiques uniquement).
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, Gavel, Snowflake } from "lucide-react";
import { lineFromPosition } from "@/lib/auction-resolution";
import type { MercatoRecap, MercatoAcquisition } from "@/lib/auction-mercato-recap";

// ── Types ──────────────────────────────────────────────────────────────────

interface Phase {
  auctionId: number;
  type: string;
  status: string;
  budgetPerUser: number;
  playersPerUser: number;
  recap: MercatoRecap;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

const chipBase =
  "text-[12px] font-bold px-3 py-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";
const chipOn = "bg-gold text-night";
const chipOff = "bg-gold/[0.08] border border-gold/30 text-[#C9B97E] hover:bg-gold/[0.14]";

// ── Composant principal ────────────────────────────────────────────────────

export default function MercatoRecapPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const leaguesRes = await fetch("/api/admin/jokers/leagues");
        const leaguesData = await leaguesRes.json();
        const league = (leaguesData.leagues ?? []).find((l: { slug: string }) => l.slug === slug);
        if (!league) {
          if (!cancelled) { setError("Ligue introuvable."); setLoading(false); }
          return;
        }
        const res = await fetch(`/api/auction/recap?leagueId=${league.dbId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Erreur de chargement.");
        } else {
          const loaded: Phase[] = data.phases ?? [];
          setPhases(loaded);
          // Phase active par défaut : la plus récente
          setPhaseIdx(Math.max(0, loaded.length - 1));
        }
      } catch {
        if (!cancelled) setError("Erreur réseau.");
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  const phase = phases[phaseIdx];

  // ── État vide : aucune enchère, ou aucun tour dépouillé ──────────────────
  if (!phase || phase.recap.rounds.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-8 pb-24 text-center">
        <div className="text-4xl mb-4">📰</div>
        <div className="font-serif italic text-[21px] font-semibold text-paper mb-2">
          Le mercato n&apos;a pas encore livré ses secrets
        </div>
        <div className="text-[13px] text-[#A39E92] leading-relaxed max-w-[300px] mx-auto">
          Le récap des acquisitions apparaîtra ici après le dépouillement du premier tour d&apos;enchères.
        </div>
      </div>
    );
  }

  const { recap } = phase;

  // Filtrage client : participant et/ou tour
  const visibleParticipants = recap.participants
    .filter((p) => selectedUser === null || p.userId === selectedUser)
    .map((p) => {
      const acqs = selectedRound === null
        ? p.acquisitions
        : p.acquisitions.filter((a) => a.round === selectedRound);
      return { ...p, filteredAcqs: acqs, filteredSpent: acqs.reduce((s, a) => s + a.amount, 0) };
    });

  const filteredPlayers = visibleParticipants.reduce((s, p) => s + p.filteredAcqs.length, 0);
  const filteredPoints = visibleParticipants.reduce((s, p) => s + p.filteredSpent, 0);
  const isWinter = phase.type === "winter";
  const singleUser = selectedUser !== null ? visibleParticipants[0] : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-2 pb-24 space-y-5">

      {/* ── HEADER ── */}
      <div className="pb-4 border-b border-[#232220] bg-gradient-to-b from-[#16160F] to-[#141414] -mx-4 px-4 pt-2">
        <div className="flex items-center gap-2 mb-1">
          {isWinter
            ? <Snowflake className="w-[18px] h-[18px] text-blue-400" aria-hidden />
            : <Gavel className="w-[18px] h-[18px] text-gold" aria-hidden />}
          <h2 className="font-serif font-bold text-[22px] text-paper leading-none">
            Récap du mercato
          </h2>
        </div>
        <div className="text-[11.5px] text-muted mb-3">
          {isWinter ? "Mercato d'hiver" : "Mercato d'été"}
          {" · "}
          {recap.rounds.length === 1 ? "1 tour dépouillé" : `${recap.rounds.length} tours dépouillés`}
          {phase.status === "resolved" && " · phase close"}
        </div>

        {/* Sélecteur de phase (visible uniquement s'il y en a plusieurs) */}
        {phases.length > 1 && (
          <div className="flex gap-2 mb-3" role="group" aria-label="Phase de mercato">
            {phases.map((ph, i) => (
              <button
                key={ph.auctionId}
                onClick={() => { setPhaseIdx(i); setSelectedRound(null); setSelectedUser(null); }}
                aria-pressed={phaseIdx === i}
                className={`${chipBase} flex items-center gap-1.5 ${phaseIdx === i ? chipOn : chipOff}`}
              >
                {ph.type === "winter" ? <Snowflake className="w-3 h-3" aria-hidden /> : <Gavel className="w-3 h-3" aria-hidden />}
                {ph.type === "winter" ? "Hiver" : "Été"}
              </button>
            ))}
          </div>
        )}

        {/* Filtre tour */}
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrer par tour">
          <button
            onClick={() => setSelectedRound(null)}
            aria-pressed={selectedRound === null}
            className={`${chipBase} ${selectedRound === null ? chipOn : chipOff}`}
          >
            Tous les tours
          </button>
          {recap.rounds.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRound(r)}
              aria-pressed={selectedRound === r}
              className={`${chipBase} ${selectedRound === r ? chipOn : chipOff}`}
            >
              T{r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtre participant ── */}
      <div>
        <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-2 px-0.5">
          Participants
        </div>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrer par participant">
          <button
            onClick={() => setSelectedUser(null)}
            aria-pressed={selectedUser === null}
            className={`${chipBase} ${selectedUser === null ? chipOn : chipOff}`}
          >
            Tous
          </button>
          {recap.participants.map((p) => (
            <button
              key={p.userId}
              onClick={() => setSelectedUser(selectedUser === p.userId ? null : p.userId)}
              aria-pressed={selectedUser === p.userId}
              className={`${chipBase} ${selectedUser === p.userId ? chipOn : chipOff}`}
            >
              {p.userName}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tuiles de synthèse (reflètent les filtres actifs) ── */}
      <div className="flex gap-2.5">
        <div className="flex-1 bg-[#16160F] border border-gold/[0.30] rounded-xl px-4 py-3">
          <div className="text-[9.5px] font-bold tracking-[1.2px] text-muted uppercase mb-1">
            Joueurs attribués
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold text-gold leading-none tabular-nums tracking-tight">
              {filteredPlayers}
            </span>
            {singleUser && (
              <span className="text-[12px] text-muted">/ {phase.playersPerUser}</span>
            )}
          </div>
        </div>
        <div className="flex-1 bg-[#1B1B19] border border-[#272521] rounded-xl px-4 py-3">
          <div className="text-[9.5px] font-bold tracking-[1.2px] text-muted uppercase mb-1">
            Points engagés
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold text-paper leading-none tabular-nums tracking-tight">
              {filteredPoints}
            </span>
            <span className="text-[12px] text-muted">
              {singleUser && selectedRound === null ? `/ ${phase.budgetPerUser} pts` : "pts"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Vue participant unique : détail riche par tour ── */}
      {singleUser ? (
        singleUser.filteredAcqs.length > 0 ? (
          <div className="space-y-4">
            {(selectedRound === null ? recap.rounds : [selectedRound]).map((round) => {
              const roundAcqs = singleUser.filteredAcqs.filter((a) => a.round === round);
              if (roundAcqs.length === 0) return null;
              return (
                <div key={round}>
                  <div className="font-serif italic font-semibold text-[16px] text-[#D8BC63] mb-2 px-0.5">
                    Tour {round}
                  </div>
                  <div className="bg-gradient-to-b from-gold/[0.10] to-gold/[0.03] border border-gold/[0.34] rounded-xl overflow-hidden">
                    {roundAcqs.map((a: MercatoAcquisition) => (
                      <div key={a.playerId} className="flex items-center gap-3 px-4 py-3 border-t border-gold/[0.16] first:border-t-0">
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
                          <div className="text-[9px] text-muted mt-0.5">pts</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#1B1B19] border border-[#272521] rounded-xl p-5 text-center">
            <div className="font-serif italic font-semibold text-[17px] text-paper mb-1.5">
              Aucune acquisition
            </div>
            <div className="text-[12.5px] text-[#A39E92]">
              {selectedRound !== null
                ? `${singleUser.userName} n'a rien remporté au tour ${selectedRound}.`
                : `${singleUser.userName} n'a encore rien remporté dans ce mercato.`}
            </div>
          </div>
        )
      ) : (
        /* ── Vue tous participants : le grand livre, style papier journal ── */
        <div>
          <div className="text-[10.5px] font-bold tracking-[1.4px] text-muted uppercase mb-2 px-0.5">
            Le grand livre du mercato
          </div>
          <div className="bg-[#F5F2EB] rounded-xl px-4 pt-4 pb-2 shadow-[0_12px_30px_rgba(0,0,0,.38)]">
            <div className="flex items-baseline justify-between border-b-[1.5px] border-[#1A1A18] pb-2 mb-1">
              <span className="font-serif font-bold text-[16px] text-[#1A1A18]">
                {selectedRound === null ? "Toutes les acquisitions" : `Acquisitions · Tour ${selectedRound}`}
              </span>
              <span className="text-[10px] text-[#8A8270] italic">prix en points</span>
            </div>
            {visibleParticipants.map((p) => (
              <div key={p.userId} className="py-2.5 border-b border-[#DAD4C5] last:border-b-0">
                <div className="flex items-baseline justify-between gap-2">
                  <button
                    onClick={() => setSelectedUser(p.userId)}
                    className="font-serif font-semibold text-[14px] text-[#1A1A18] hover:text-[#7A6A2E] transition-colors text-left focus-visible:outline-none focus-visible:underline"
                    title={`Voir le détail de ${p.userName}`}
                  >
                    {p.userName}
                  </button>
                  <span className="text-[11px] font-bold text-[#5A564C] tabular-nums whitespace-nowrap flex-none">
                    +{p.filteredAcqs.length} · {p.filteredSpent} pts
                  </span>
                </div>
                {p.filteredAcqs.length > 0 ? (
                  <div className="text-[11.5px] text-[#4A463C] mt-0.5 leading-relaxed">
                    {p.filteredAcqs.map((a) =>
                      selectedRound === null
                        ? `${a.playerName} ${a.amount} (T${a.round})`
                        : `${a.playerName} ${a.amount}`
                    ).join("  ·  ")}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#8A8270] italic mt-0.5">
                    {selectedRound === null ? "aucune acquisition" : "aucune acquisition ce tour"}
                  </div>
                )}
              </div>
            ))}
            <div className="text-center text-[9.5px] text-[#8A8270] italic py-2">
              Acquisitions des tours dépouillés · cliquez sur un nom pour le détail
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
