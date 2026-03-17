"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Send, Loader2, ChevronDown, Info, Image as ImageIcon } from "lucide-react";

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
}

export default function AdminNotesPage() {
  const [day, setDay] = useState(27);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [showOnlyFilled, setShowOnlyFilled] = useState(false);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/scores?day=${day}`);
      const data = await res.json();
      setScores(data.scores ?? []);
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
        .filter((s) => s.used > 0 || s.points !== null || s.goals > 0 || s.passes > 0)
        .map((s) => ({
          playerId: s.playerId,
          used: s.used,
          points: s.points,
          goals: s.goals,
          passes: s.passes,
        }));

      const res = await fetch("/api/admin/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, scores: toSave }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Sauvegardé (${toSave.length} joueurs)`);
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur sauvegarde");
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!confirm(`Publier la journée ${day} ? Cela recalculera les classements pour toutes les ligues.`)) return;
    setPublishing(true);
    setMessage("");
    try {
      // Save first
      await handleSave();
      // Then publish
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Journée ${day} publiée avec succès !`);
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur publication");
    }
    setPublishing(false);
  }

  // Group by club
  const filteredScores = scores.filter((s) => {
    if (showOnlyFilled && s.points === null && s.goals === 0 && s.passes === 0) return false;
    if (filter && !s.clubName.toLowerCase().includes(filter.toLowerCase()) &&
        !`${s.fname} ${s.lname}`.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const clubs = Array.from(new Set(filteredScores.map((s) => s.clubName))).sort();

  const filledCount = scores.filter((s) => s.points !== null).length;
  const totalWithGoals = scores.filter((s) => s.goals > 0).reduce((sum, s) => sum + s.goals, 0);

  // Infographics for this matchday
  const [infographics, setInfographics] = useState<{ home_team: string; away_team: string; home_score: number | null; away_score: number | null; infographic_url: string | null }[]>([]);
  useEffect(() => {
    fetch(`/api/admin/match-schedule?day=${day}`)
      .then((r) => r.json())
      .then((d) => setInfographics(d.matches ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-white mb-1">Saisie des notes</h1>
          <p className="text-sm text-muted">{filledCount} joueurs notés - {totalWithGoals} buts saisis</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Day selector */}
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

          {/* Infographics button */}
          {infographics.some((m) => m.infographic_url) && (
            <div className="flex gap-1">
              {infographics.filter((m) => m.infographic_url).map((m) => (
                <a
                  key={`${m.home_team}-${m.away_team}`}
                  href={m.infographic_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-2 bg-surface-2 border border-white/[0.07] rounded text-[10px] text-muted hover:text-gold hover:border-gold/30 flex items-center gap-1 transition-colors"
                  title={`Notes ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`}
                >
                  <ImageIcon className="w-3 h-3" />
                  {m.home_team.split(" ").pop()}-{m.away_team.split(" ").pop()}
                </a>
              ))}
            </div>
          )}

          {/* Pre-fill button (disabled) */}
          <button
            disabled
            className="h-9 px-3 bg-surface-2 border border-white/[0.07] rounded text-sm text-muted cursor-not-allowed flex items-center gap-2"
            title="Disponible en production - récupère buts/passes/cartons automatiquement"
          >
            <Info className="w-3.5 h-3.5" />
            Pré-remplir API
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 bg-surface-2 border border-white/[0.07] rounded text-sm text-white hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 transition-colors"
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publier la journée
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher joueur ou club..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-surface-2 border border-white/[0.07] rounded px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-gold w-64"
        />
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyFilled}
            onChange={(e) => setShowOnlyFilled(e.target.checked)}
            className="accent-gold"
          />
          Joueurs notés uniquement
        </label>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        /* Table by club */
        <div className="space-y-4">
          {clubs.map((clubName) => {
            const clubPlayers = filteredScores.filter((s) => s.clubName === clubName);
            return (
              <div key={clubName} className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
                <div className="bg-surface-2 px-4 py-2 border-b border-white/[0.07]">
                  <h3 className="text-sm font-medium text-white">{clubName}</h3>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem_3rem_3rem_4rem] gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07]">
                  <span>Joueur</span>
                  <span className="text-center">Note</span>
                  <span className="text-center">Buts</span>
                  <span className="text-center">Pass.</span>
                  <span className="text-center">Joué</span>
                  <span className="text-right">Total</span>
                </div>

                {/* Player rows */}
                {clubPlayers.map((s) => {
                  const total = (s.points ?? 0) + 2 * s.goals + s.passes;
                  const hasData = s.points !== null || s.goals > 0 || s.passes > 0;
                  return (
                    <div
                      key={s.playerId}
                      className={`grid grid-cols-[1fr_3.5rem_3.5rem_3rem_3rem_4rem] gap-1 px-3 py-1.5 items-center border-b border-white/[0.05] last:border-b-0 ${
                        hasData ? "bg-gold/[0.02]" : ""
                      }`}
                    >
                      {/* Name */}
                      <div className="min-w-0">
                        <span className="text-sm text-white truncate block">{s.fname} {s.lname}</span>
                        <span className="text-[10px] text-muted">{s.position}</span>
                      </div>

                      {/* Note */}
                      <input
                        type="number"
                        value={s.points ?? ""}
                        onChange={(e) => updateScore(s.playerId, "points", e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-surface-2 border border-white/[0.07] rounded px-1.5 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
                        min={0}
                        max={10}
                        step={1}
                      />

                      {/* Goals */}
                      <input
                        type="number"
                        value={s.goals || ""}
                        onChange={(e) => updateScore(s.playerId, "goals", Number(e.target.value) || 0)}
                        className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
                        min={0}
                      />

                      {/* Passes */}
                      <input
                        type="number"
                        value={s.passes || ""}
                        onChange={(e) => updateScore(s.playerId, "passes", Number(e.target.value) || 0)}
                        className="w-full bg-surface-2 border border-white/[0.07] rounded px-1 py-1 text-xs text-center text-white focus:outline-none focus:border-gold"
                        min={0}
                      />

                      {/* Used checkbox */}
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={s.used > 0}
                          onChange={(e) => updateScore(s.playerId, "used", e.target.checked ? 1 : 0)}
                          className="accent-gold"
                        />
                      </div>

                      {/* Calculated total */}
                      <span className={`text-xs font-medium text-right tabular-nums ${total > 0 ? "text-white" : "text-muted"}`}>
                        {hasData ? total.toFixed(1) : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
