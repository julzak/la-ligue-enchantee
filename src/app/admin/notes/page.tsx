"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Send, Loader2, ChevronDown, Image as ImageIcon } from "lucide-react";

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
}

interface MatchInfo {
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  infographic_url: string | null;
}

// Club logos (same as assets.ts but client-side)
const CLUB_LOGOS: Record<number, string> = {
  241: "/clubs/angers.png", 243: "/clubs/auxerre.png", 201: "/clubs/brest.png",
  242: "/clubs/le-havre.png", 232: "/clubs/lens.png", 203: "/clubs/lille.png",
  245: "/clubs/lorient.png", 205: "/clubs/lyon.png", 206: "/clubs/marseille.png",
  244: "/clubs/metz.png", 208: "/clubs/monaco.png", 210: "/clubs/nantes.png",
  211: "/clubs/nice.png", 246: "/clubs/parisfc.png", 212: "/clubs/psg.png",
  214: "/clubs/rennes.png", 230: "/clubs/strasbourg.png", 199: "/clubs/toulouse.png",
};

// Match TheSportsDB team name to DB club name
function teamToClubName(team: string): string[] {
  const map: Record<string, string[]> = {
    "Marseille": ["MARSEILLE (OM)"], "Olympique Marseille": ["MARSEILLE (OM)"],
    "Lyon": ["LYON (OL)"], "Olympique Lyonnais": ["LYON (OL)"],
    "Monaco": ["MONACO (ASM)"],
    "Lille": ["LILLE"], "LOSC Lille": ["LILLE"],
    "Rennes": ["RENNES"],
    "Le Havre": ["LE HAVRE"],
    "Metz": ["METZ"],
    "Toulouse": ["TOULOUSE"],
    "Strasbourg": ["STRASBOURG"],
    "Paris FC": ["PARIS FC"], "Paris": ["PARIS FC"],
    "Lens": ["LENS"],
    "Lorient": ["LORIENT"],
    "Brest": ["BREST"],
    "Angers": ["ANGERS"], "Angers SCO": ["ANGERS"],
    "Nice": ["NICE"],
    "Auxerre": ["AUXERRE"],
    "Nantes": ["NANTES"],
    "Paris SG": ["PARIS-SG (PSG)"], "Paris Saint Germain": ["PARIS-SG (PSG)"],
  };
  return map[team] ?? [team];
}

export default function AdminNotesPage() {
  const [day, setDay] = useState(0);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showOnlyFilled, setShowOnlyFilled] = useState(false);
  const [matches, setMatches] = useState<MatchInfo[]>([]);

  // Auto-detect current matchday on mount
  useEffect(() => {
    if (day === 0) {
      fetch("/api/admin/scores?day=0")
        .then((r) => r.json())
        .then((d) => { if (d.day) setDay(d.day); else setDay(26); })
        .catch(() => setDay(26));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchScores = useCallback(async () => {
    if (day === 0) return;
    setLoading(true);
    setMessage("");
    try {
      const [scoresRes, matchRes] = await Promise.all([
        fetch(`/api/admin/scores?day=${day}`),
        fetch(`/api/admin/match-schedule?day=${day}`),
      ]);
      const scoresData = await scoresRes.json();
      const matchData = await matchRes.json();
      setScores(scoresData.scores ?? []);
      setMatches(matchData.matches ?? []);
    } catch {
      setMessage("Erreur chargement");
    }
    setLoading(false);
  }, [day]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  function updateScore(playerId: number, field: keyof PlayerScore, value: number | null) {
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
  }

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
        setLastSaved(new Date().toLocaleString("fr-FR"));
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

  // Group players by match
  function getMatchPlayers(match: MatchInfo): { home: PlayerScore[]; away: PlayerScore[] } {
    const homeClubs = teamToClubName(match.home_team);
    const awayClubs = teamToClubName(match.away_team);
    return {
      home: scores.filter((s) => homeClubs.includes(s.clubName)),
      away: scores.filter((s) => awayClubs.includes(s.clubName)),
    };
  }

  // Players not in any match (unmatched clubs)
  const matchedClubs = new Set(
    matches.flatMap((m) => [...teamToClubName(m.home_team), ...teamToClubName(m.away_team)])
  );
  const unmatchedPlayers = scores.filter((s) => !matchedClubs.has(s.clubName));
  const unmatchedClubs = Array.from(new Set(unmatchedPlayers.map((s) => s.clubName))).sort();

  const filledCount = scores.filter((s) => s.points !== null).length;
  const totalWithGoals = scores.filter((s) => s.goals > 0).reduce((sum, s) => sum + s.goals, 0);

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

  function PlayerRow({ s }: { s: PlayerScore }) {
    if (filter && !`${s.fname} ${s.lname}`.toLowerCase().includes(filter.toLowerCase())) return null;
    if (showOnlyFilled && s.points === null && s.goals === 0 && s.passes === 0) return null;
    const total = calcTotal(s);
    const hasData = s.points !== null;
    return (
      <div className={`grid grid-cols-[minmax(0,1fr)_3rem_2.5rem_2.5rem_2rem_2rem_2rem_3rem] gap-0.5 px-2 py-1 items-center border-b border-white/[0.04] last:border-b-0 ${hasData ? "bg-gold/[0.02]" : ""}`}>
        <span className="text-xs text-white truncate flex items-center gap-1" title={`${s.fname} ${s.lname} (${s.position})`}>
          {CLUB_LOGOS[s.clubId] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={CLUB_LOGOS[s.clubId]} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
          )}
          {s.lname}
        </span>
        <input
          type="number"
          value={s.points ?? ""}
          onChange={(e) => updateScore(s.playerId, "points", e.target.value ? Number(e.target.value) : null)}
          placeholder="—"
          className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0} max={10} step={1}
        />
        <input
          type="number"
          value={s.goals || ""}
          onChange={(e) => updateScore(s.playerId, "goals", Number(e.target.value) || 0)}
          className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
        />
        <input
          type="number"
          value={s.passes || ""}
          onChange={(e) => updateScore(s.playerId, "passes", Number(e.target.value) || 0)}
          className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none focus:border-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
        />
        {/* CSC */}
        <input
          type="number"
          value={s.ownGoals || ""}
          onChange={(e) => updateScore(s.playerId, "ownGoals", Number(e.target.value) || 0)}
          className="w-full bg-surface-2 border border-rouge/20 rounded px-1 py-0.5 text-xs text-center text-rouge focus:outline-none focus:border-rouge [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
        />
        {/* Red card */}
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={s.redCard > 0}
            onChange={(e) => updateScore(s.playerId, "redCard", e.target.checked ? 1 : 0)}
            className="accent-red-600 w-3.5 h-3.5"
            title="Carton rouge"
          />
        </div>
        {/* Penalty saved — only for GK */}
        {isGK(s.position) ? (
          <input
            type="number"
            value={s.penaltySaved || ""}
            onChange={(e) => updateScore(s.playerId, "penaltySaved", Number(e.target.value) || 0)}
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
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-white mb-1">Saisie des notes</h1>
          <p className="text-sm text-muted">
            {filledCount} joueurs notés · {totalWithGoals} buts
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

          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyFilled}
              onChange={(e) => setShowOnlyFilled(e.target.checked)}
              className="accent-gold"
            />
            Notés
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
                <div key={`${match.home_team}-${match.away_team}`} className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
                  {/* Match header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-surface-2 border-b border-white/[0.07]">
                    <span className="text-sm font-medium text-white">{match.home_team.split(" ").pop()}</span>
                    <span className="text-sm font-serif font-bold text-gold tabular-nums">{score}</span>
                    <span className="text-sm font-medium text-white">{match.away_team.split(" ").pop()}</span>
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

                  {/* Column headers */}
                  <div className="grid grid-cols-[minmax(0,1fr)_3rem_2.5rem_2.5rem_2rem_2rem_2rem_3rem] gap-0.5 px-2 py-1 text-[9px] uppercase tracking-wider text-muted border-b border-white/[0.05]">
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
                    {home.map((s) => <PlayerRow key={s.playerId} s={s} />)}
                  </div>

                  {/* Away team — subtle separator */}
                  <div className="border-t border-gold/10">
                    {away.map((s) => <PlayerRow key={s.playerId} s={s} />)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unmatched clubs (not in MATCH_SCHEDULE) */}
          {unmatchedClubs.length > 0 && (
            <details className="group">
              <summary className="text-sm text-muted cursor-pointer hover:text-white transition-colors list-none flex items-center gap-2 py-2">
                <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Autres clubs ({unmatchedClubs.length})
              </summary>
              <div className="grid gap-4 lg:grid-cols-2 mt-4">
                {unmatchedClubs.map((clubName) => {
                  const clubPlayers = unmatchedPlayers.filter((s) => s.clubName === clubName);
                  return (
                    <div key={clubName} className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
                      <div className="bg-surface-2 px-4 py-2 border-b border-white/[0.07]">
                        <span className="text-sm font-medium text-white">{clubName}</span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_3rem_2.5rem_2.5rem_3rem] gap-1 px-3 py-1 text-[9px] uppercase tracking-wider text-muted border-b border-white/[0.05]">
                        <span>Joueur</span>
                        <span className="text-center">Note</span>
                        <span className="text-center">But</span>
                        <span className="text-center">Pas</span>
                        <span className="text-right">Tot.</span>
                      </div>
                      {clubPlayers.map((s) => <PlayerRow key={s.playerId} s={s} />)}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
