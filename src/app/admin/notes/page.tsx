"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Save, Send, Loader2, ChevronDown, Image as ImageIcon, CalendarClock } from "lucide-react";
import { canonicalClubKey, getClubLogoUrlByName } from "@/lib/assets";

interface PlayerScore {
  playerId: number;
  fname: string;
  lname: string;
  position: string;
  clubId: number;
  clubName: string;
  used: number;
  points: number | null;
  goals: number;
  passes: number;
  redCard: number;
  ownGoals: number;
  penaltySaved: number;
  isTaken?: boolean;
}

interface MatchInfo {
  id: number;
  home_team: string;
  away_team: string;
  match_date: string | null;
  home_score: number | null;
  away_score: number | null;
  is_postponed: number | null;
  admin_override_date: string | null;
  infographic_url: string | null;
}

// L'appariement nom de match (MATCH_SCHEDULE) <-> nom de club (CLUB) passe par
// la clé canonique d'assets.ts, robuste aux variantes de fournisseur (legacy
// "MARSEILLE (OM)", TheSportsDB "Marseille", football-data "Olympique de
// Marseille"). AVANT le 2026-08-17 : table locale figée sur les libellés
// TheSportsDB, qui rattachait les joueurs aux mauvais noms après le passage du
// calendrier à football-data (Angers et Paris FC sans joueurs sous leur match).

function getPositionGoalBonus(position: string): number {
  const lower = position.toLowerCase();
  if (lower.includes("gardien")) return 10;
  if (lower.includes("fense")) return 4;
  return 2; // MID + ATT
}

function calcTotal(s: PlayerScore): number {
  const base = s.redCard ? 0 : (s.points ?? 0);
  const goalBonus = getPositionGoalBonus(s.position) * s.goals;
  return base + goalBonus + s.passes - 2 * s.ownGoals + 2 * s.penaltySaved;
}

const isGK = (position: string) => position.toLowerCase().includes("gardien");

// Memoized PlayerRow to prevent re-renders of all rows when one input changes
const PlayerRow = memo(function PlayerRow({ s, onUpdate, showInitials }: { s: PlayerScore; onUpdate: (playerId: number, field: keyof PlayerScore, value: number | null) => void; showInitials: boolean }) {
  const total = calcTotal(s);
  const hasData = s.points !== null;
  const logo = getClubLogoUrlByName(s.clubName);
  return (
    <div className={`grid grid-cols-[minmax(6.5rem,1fr)_3rem_2.5rem_2.5rem_2rem_2rem_2rem_3rem] min-w-[420px] gap-0.5 px-2 py-1 items-center border-b border-white/[0.04] last:border-b-0 ${hasData ? "bg-gold/[0.02]" : ""}`}>
      <span className="text-xs text-white truncate flex items-center gap-1" title={`${s.fname} ${s.lname} (${s.position})`}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
        )}
        {showInitials && s.fname ? `${s.fname.charAt(0)}. ${s.lname}` : s.lname}
      </span>
      <input
        type="number"
        value={s.points ?? ""}
        onChange={(e) => onUpdate(s.playerId, "points", e.target.value ? Number(e.target.value) : null)}
        placeholder="—"
        className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={0} max={10} step={1}
      />
      <input
        type="number"
        value={s.goals || ""}
        onChange={(e) => onUpdate(s.playerId, "goals", Number(e.target.value) || 0)}
        className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={0}
      />
      <input
        type="number"
        value={s.passes || ""}
        onChange={(e) => onUpdate(s.playerId, "passes", Number(e.target.value) || 0)}
        className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={0}
      />
      {/* CSC */}
      <input
        type="number"
        value={s.ownGoals || ""}
        onChange={(e) => onUpdate(s.playerId, "ownGoals", Number(e.target.value) || 0)}
        className="w-full bg-surface-2 border border-rouge/20 rounded px-1 py-0.5 text-xs text-center text-rouge focus:outline-none focus:border-rouge [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={0}
      />
      {/* Red card */}
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={s.redCard > 0}
          onChange={(e) => onUpdate(s.playerId, "redCard", e.target.checked ? 1 : 0)}
          className="accent-red-600 w-3.5 h-3.5"
          title="Carton rouge"
        />
      </div>
      {/* Penalty saved — only for GK */}
      {isGK(s.position) ? (
        <input
          type="number"
          value={s.penaltySaved || ""}
          onChange={(e) => onUpdate(s.playerId, "penaltySaved", Number(e.target.value) || 0)}
          className="w-full bg-surface-2 border border-vert/20 rounded px-1 py-0.5 text-xs text-center text-vert focus:outline-none focus:border-vert [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
        />
      ) : (
        <span />
      )}
      <span className={`text-xs text-right tabular-nums ${hasData ? "text-white font-medium" : "text-muted"}`}>
        {hasData ? total.toFixed(1) : ""}
      </span>
    </div>
  );
});

function PostponedControls({ match, onUpdate }: { match: MatchInfo; onUpdate: (id: number, patch: { is_postponed?: 0 | 1; admin_override_date?: string | null }) => void }) {
  const isPostponed = match.is_postponed === 1;
  const hasResult = match.home_score !== null;
  const overrideDate = match.admin_override_date ? new Date(match.admin_override_date).toISOString().slice(0, 10) : "";

  if (!isPostponed && hasResult) return null;

  if (!isPostponed) {
    return (
      <div className="px-4 py-1.5 border-b border-white/[0.05] flex justify-end">
        <button
          onClick={() => onUpdate(match.id, { is_postponed: 1 })}
          className="text-[10px] text-muted hover:text-orange-400 flex items-center gap-1 transition-colors"
          title="Marquer ce match comme reporte"
        >
          <CalendarClock className="w-3 h-3" />
          Reporter
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 border-b border-white/[0.05] bg-orange-400/5 flex items-center gap-3 text-[11px]">
      <span className="text-orange-400 font-medium flex items-center gap-1">
        <CalendarClock className="w-3.5 h-3.5" />
        Reporte
      </span>
      {hasResult ? (
        overrideDate ? (
          <span className="text-muted">joue le {new Date(overrideDate).toLocaleDateString("fr-FR")}</span>
        ) : (
          <span className="text-muted">joue (date initiale appliquee)</span>
        )
      ) : (
        <>
          <label className="text-muted">Rejoue le</label>
          <input
            type="date"
            defaultValue={overrideDate}
            onBlur={(e) => {
              const newVal = e.target.value || null;
              const oldVal = overrideDate || null;
              if (newVal !== oldVal) onUpdate(match.id, { admin_override_date: newVal });
            }}
            className="bg-surface-2 border border-white/[0.07] rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-gold"
          />
          <button
            onClick={() => onUpdate(match.id, { is_postponed: 0, admin_override_date: null })}
            className="ml-auto text-muted hover:text-rouge transition-colors"
            title="Annuler le report"
          >
            Annuler
          </button>
        </>
      )}
    </div>
  );
}

export default function AdminNotesPage() {
  const [day, setDay] = useState(0);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("notes_lastSaved");
    return null;
  });
  const [filter, setFilter] = useState("");
  const [showOnlyFilled, setShowOnlyFilled] = useState(false);
  const [showOnlyTaken, setShowOnlyTaken] = useState(true);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [deadline, setDeadline] = useState("");
  const [deadlineSaved, setDeadlineSaved] = useState(false);
  const [showInitials, setShowInitials] = useState(false);

  // Auto-detect current matchday on mount
  useEffect(() => {
    if (day === 0) {
      fetch("/api/admin/scores?day=0")
        .then((r) => r.json())
        .then((d) => { if (d.day) setDay(d.day); else setDay(1); })
        .catch(() => setDay(1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchScores = useCallback(async () => {
    if (day === 0) return;
    setLoading(true);
    setMessage("");
    try {
      const [scoresRes, matchRes, deadlineRes] = await Promise.all([
        fetch(`/api/admin/scores?day=${day}`),
        fetch(`/api/admin/match-schedule?day=${day}`),
        fetch(`/api/admin/deadline?day=${day}`),
      ]);
      const scoresData = await scoresRes.json();
      const matchData = await matchRes.json();
      const deadlineData = await deadlineRes.json();
      setScores(scoresData.scores ?? []);
      setMatches(matchData.matches ?? []);
      if (deadlineData.lockAt) {
        setDeadline(new Date(deadlineData.lockAt).toISOString().slice(0, 16));
      } else {
        setDeadline("");
      }
      setDeadlineSaved(false);
    } catch {
      setMessage("Erreur chargement");
    }
    setLoading(false);
  }, [day]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const updateScore = useCallback((playerId: number, field: keyof PlayerScore, value: number | null) => {
    setScores((prev) =>
      prev.map((s) => {
        if (s.playerId !== playerId) return s;
        const updated = { ...s, [field]: value };
        // Auto-set used=1 when a note is entered
        if (field === "points" && value !== null && value > 0) {
          updated.used = 1;
        }
        return updated;
      })
    );
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const toSave = scores
        .filter((s) => s.used > 0 || s.points !== null || s.goals > 0 || s.passes > 0 || s.redCard > 0 || s.ownGoals > 0 || s.penaltySaved > 0)
        .map((s) => ({
          playerId: s.playerId,
          used: s.points !== null && s.points > 0 ? 1 : s.used,
          points: s.points,
          goals: s.goals,
          passes: s.passes,
          redCard: s.redCard,
          ownGoals: s.ownGoals,
          penaltySaved: s.penaltySaved,
        }));

      const res = await fetch("/api/admin/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, scores: toSave }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Sauvegardé (${toSave.length} joueurs)`);
        const ts = new Date().toLocaleString("fr-FR");
        setLastSaved(ts);
        localStorage.setItem("notes_lastSaved", ts);
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur sauvegarde");
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!confirm(`Publier la journée ${day} ? Cela recalculera les classements.`)) return;
    setPublishing(true);
    setMessage("");
    try {
      await handleSave();
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day }),
      });
      const data = await res.json();
      if (data.ok) setMessage(`Journée ${day} publiée !`);
      else setMessage("Erreur: " + data.error);
    } catch {
      setMessage("Erreur publication");
    }
    setPublishing(false);
  }

  async function handleUpdateMatch(matchId: number, patch: { is_postponed?: 0 | 1; admin_override_date?: string | null }) {
    try {
      const res = await fetch("/api/admin/match-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: matchId, ...patch }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage("Erreur: " + (data.error ?? "report match"));
        return;
      }
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } as MatchInfo : m)));
      setMessage("Match mis a jour");
    } catch {
      setMessage("Erreur report match");
    }
  }

  // Group players by match
  // Nom de club complet (celui de la table CLUB, affiché partout ailleurs)
  // pour les en-têtes de match, à la place de l'abréviation (demande Pierre,
  // 2026-08-18 : les mêmes noms partout). Repli sur le nom MATCH_SCHEDULE.
  function fullClubName(matchTeam: string): string {
    const key = canonicalClubKey(matchTeam);
    const s = scores.find((sc) => canonicalClubKey(sc.clubName) === key);
    return s?.clubName ?? matchTeam;
  }

  function getMatchPlayers(match: MatchInfo): { home: PlayerScore[]; away: PlayerScore[] } {
    const homeKey = canonicalClubKey(match.home_team);
    const awayKey = canonicalClubKey(match.away_team);

    function filterPlayers(clubKey: string) {
      return scores.filter((s) => {
        if (canonicalClubKey(s.clubName) !== clubKey) return false;
        if (filter && !`${s.fname} ${s.lname}`.toLowerCase().includes(filter.toLowerCase())) return false;
        if (showOnlyFilled && s.points === null && s.goals === 0 && s.passes === 0) return false;
        if (showOnlyTaken && !s.isTaken && s.points === null && s.goals === 0) return false;
        return true;
      });
    }

    return {
      home: filterPlayers(homeKey),
      away: filterPlayers(awayKey),
    };
  }

  const filledCount = scores.filter((s) => s.points !== null).length;
  const totalWithGoals = scores.filter((s) => s.goals > 0).reduce((sum, s) => sum + s.goals, 0);
  const takenCount = scores.filter((s) => s.isTaken).length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header — sticky on mobile for easy access to save/publish */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20 bg-night pt-2 pb-3 -mt-2 border-b border-white/[0.07]">
        <div>
          <h1 className="font-serif text-2xl text-white mb-1">Saisie des notes</h1>
          <p className="text-sm text-muted">
            {filledCount} joueurs notés · {totalWithGoals} buts
            {showOnlyTaken && <span className="ml-1">· {takenCount} joueurs pris</span>}
            {lastSaved && <span className="ml-2 text-white/30">· Sauvé {lastSaved}</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ChevronDown className="w-4 h-4 text-muted" />
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="bg-surface-2 border border-white/[0.07] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gold"
            >
              {Array.from({ length: 38 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Journée {d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => { setDeadline(e.target.value); setDeadlineSaved(false); }}
              className="bg-surface-2 border border-white/[0.07] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gold"
            />
            <button
              onClick={async () => {
                if (!deadline) return;
                await fetch("/api/admin/deadline", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ day, lockAt: deadline }),
                });
                setDeadlineSaved(true);
              }}
              className="text-[10px] bg-surface-2 border border-white/[0.07] rounded px-2 py-1 text-muted hover:text-gold transition-colors"
            >
              {deadlineSaved ? "✓" : "Deadline"}
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyTaken}
              onChange={(e) => setShowOnlyTaken(e.target.checked)}
              className="accent-gold"
            />
            Pris
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyFilled}
              onChange={(e) => setShowOnlyFilled(e.target.checked)}
              className="accent-gold"
            />
            Notés
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showInitials}
              onChange={(e) => setShowInitials(e.target.checked)}
              className="accent-gold"
            />
            Prénoms
          </label>

          <input
            type="text"
            placeholder="Filtrer..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-surface-2 border border-white/[0.07] rounded px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-gold w-36"
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 bg-surface-2 border border-white/[0.07] rounded text-sm text-white hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 transition-colors"
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publier
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <>
          {/* Match-based layout */}
          <div className="grid gap-4 lg:grid-cols-2">
            {matches.map((match) => {
              const { home, away } = getMatchPlayers(match);
              const score = match.home_score !== null ? `${match.home_score}-${match.away_score}` : "—";
              return (
                <div key={`${match.home_team}-${match.away_team}`} className="bg-surface rounded-lg border border-white/[0.07]">
                  {/* Match header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-surface-2 border-b border-white/[0.07]">
                    <span className="text-sm font-medium text-white truncate">{fullClubName(match.home_team)}</span>
                    <span className="text-sm font-serif font-bold text-gold tabular-nums shrink-0 px-2">{score}</span>
                    <span className="text-sm font-medium text-white truncate text-right">{fullClubName(match.away_team)}</span>
                    {match.infographic_url && (
                      <a
                        href={match.infographic_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-gold transition-colors ml-2"
                        title="Voir l'infographie"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {/* Postponed match controls */}
                  <PostponedControls match={match} onUpdate={handleUpdateMatch} />

                  <div className="overflow-x-auto">
                    {/* Sticky column headers */}
                    <div className="grid grid-cols-[minmax(6.5rem,1fr)_3rem_2.5rem_2.5rem_2rem_2rem_2rem_3rem] min-w-[420px] gap-0.5 px-2 py-1 text-[9px] uppercase tracking-wider text-muted border-b border-white/[0.05] sticky top-0 bg-surface z-10">
                      <span>Joueur</span>
                      <span className="text-center">Note</span>
                      <span className="text-center">But</span>
                      <span className="text-center">Pas</span>
                      <span className="text-center text-rouge/70">CSC</span>
                      <span className="text-center text-rouge/70">🟥</span>
                      <span className="text-center text-vert/70">Pen</span>
                      <span className="text-right">Tot.</span>
                    </div>

                    {/* Home team */}
                    <div className="border-b border-white/[0.05]">
                      {home.map((s) => <PlayerRow key={s.playerId} s={s} onUpdate={updateScore} showInitials={showInitials} />)}
                    </div>

                    {/* Away team — subtle separator */}
                    <div className="border-t border-gold/10">
                      {away.map((s) => <PlayerRow key={s.playerId} s={s} onUpdate={updateScore} showInitials={showInitials} />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </>
      )}
    </div>
  );
}
