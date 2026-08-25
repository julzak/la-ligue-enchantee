"use client";

import { useState, useEffect } from "react";
import { ArrowUpDown, Loader2, Pencil, Star, Trophy, Leaf, Circle, Minus, Plus, X } from "lucide-react";

// Miroir de la liste blanche TROPHY_FILES côté API. Signification des couleurs
// d'étoiles héritée de l'ancien site (une étoile par titre de division).
const TROPHY_DEFS: { key: string; label: string; color: string; icon: React.ElementType }[] = [
  { key: "etoile_rouge", label: "Étoile rouge", color: "#C0392B", icon: Star },
  { key: "etoile_jaune", label: "Étoile jaune", color: "#C8A84B", icon: Star },
  { key: "etoile_noire", label: "Étoile noire", color: "#8B6914", icon: Star },
  { key: "etoile_bleue", label: "Étoile bleue", color: "#4A7FC1", icon: Star },
  { key: "etoile_verte", label: "Étoile verte", color: "#4C9A6B", icon: Star },
  { key: "coupe", label: "Coupe", color: "#C8A84B", icon: Trophy },
  { key: "champion_automne", label: "Champion d'automne", color: "#E07A5F", icon: Leaf },
  { key: "ballon_dor", label: "Ballon d'or", color: "#C8A84B", icon: Circle },
];

interface Participant {
  userId: number;
  name: string;
  trophies: Record<string, number>;
}

interface LeagueData {
  id: number;
  name: string;
  participants: Participant[];
}

export default function PromotionsPage() {
  const [leagues, setLeagues] = useState<LeagueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [trophyEditor, setTrophyEditor] = useState<{ userId: number; name: string; counts: Record<string, number> } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promotions");
      const data = await res.json();
      setLeagues(data.leagues ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function moveParticipant(userId: number, fromLeagueId: number, toLeagueId: number) {
    if (!toLeagueId || toLeagueId === fromLeagueId) return;
    const fromLeague = leagues.find((l) => l.id === fromLeagueId);
    const toLeague = leagues.find((l) => l.id === toLeagueId);
    const participant = fromLeague?.participants.find((p) => p.userId === userId);
    if (!confirm(`Déplacer ${participant?.name} de "${fromLeague?.name}" vers "${toLeague?.name}" ?`)) return;

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, fromLeagueId, toLeagueId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`${participant?.name} déplacé vers ${toLeague?.name}`);
        await loadData();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setSaving(false);
  }

  async function renameParticipant(userId: number, currentName: string) {
    const newName = prompt("Nouveau pseudo :", currentName);
    if (!newName || newName.trim() === currentName) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newName: newName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Pseudo modifie : ${currentName} → ${newName.trim()}`);
        await loadData();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur reseau");
    }
    setSaving(false);
  }

  async function saveTrophies() {
    if (!trophyEditor) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: trophyEditor.userId, trophies: trophyEditor.counts }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Trophées de ${trophyEditor.name} mis à jour`);
        setTrophyEditor(null);
        await loadData();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setSaving(false);
  }

  function bumpTrophy(key: string, delta: number) {
    setTrophyEditor((ed) => {
      if (!ed) return ed;
      const next = Math.max(0, (ed.counts[key] ?? 0) + delta);
      return { ...ed, counts: { ...ed.counts, [key]: next } };
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <ArrowUpDown className="w-6 h-6 text-gold" />
          Mouvements Equipes
        </h1>
        <p className="text-sm text-muted">Déplacer, renommer des participants entre les ligues</p>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded text-sm ${message.includes("Erreur") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {leagues.filter((l) => l.participants.length > 0).map((league) => (
            <div key={league.id} className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
              <div className="bg-surface-2 px-4 py-2 border-b border-white/[0.07]">
                <span className="text-sm text-white font-medium">{league.name}</span>
                <span className="text-xs text-muted ml-2">({league.participants.length})</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {league.participants.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between px-3 py-2 gap-2">
                    <span className="text-sm text-white truncate flex-1 flex items-center gap-1">
                      {p.name}
                      <button
                        onClick={() => renameParticipant(p.userId, p.name)}
                        disabled={saving}
                        className="p-0.5 text-white/20 hover:text-gold transition-colors disabled:opacity-50"
                        title="Renommer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setTrophyEditor({ userId: p.userId, name: p.name, counts: { ...p.trophies } })}
                        disabled={saving}
                        className="p-0.5 text-white/20 hover:text-gold transition-colors disabled:opacity-50"
                        title="Trophées"
                      >
                        <Trophy className="w-3 h-3" />
                      </button>
                      <span className="inline-flex items-center gap-px">
                        {TROPHY_DEFS.filter((d) => (p.trophies[d.key] ?? 0) > 0).map((d) => {
                          const Icon = d.icon;
                          const n = p.trophies[d.key];
                          return (
                            <span key={d.key} className="inline-flex items-center" title={`${d.label} x${n}`}>
                              <Icon className="w-3 h-3" style={{ color: d.color }} fill={d.color} />
                              {n > 1 && <sup className="text-[8px] font-bold leading-none" style={{ color: d.color }}>{n}</sup>}
                            </span>
                          );
                        })}
                      </span>
                    </span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const toId = Number(e.target.value);
                        if (toId) moveParticipant(p.userId, league.id, toId);
                        e.target.value = "";
                      }}
                      disabled={saving}
                      className="bg-surface-2 border border-white/[0.07] rounded px-2 py-1 text-xs text-muted focus:outline-none focus:border-gold disabled:opacity-50 w-28 shrink-0"
                    >
                      <option value="">Déplacer...</option>
                      {leagues.filter((l) => l.id !== league.id).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {trophyEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setTrophyEditor(null)}>
          <div
            className="bg-surface border border-white/10 rounded-lg w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-surface-2 px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
              <span className="text-sm text-white font-medium">Trophées de {trophyEditor.name}</span>
              <button onClick={() => setTrophyEditor(null)} className="text-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {TROPHY_DEFS.map((d) => {
                const Icon = d.icon;
                const n = trophyEditor.counts[d.key] ?? 0;
                return (
                  <div key={d.key} className="flex items-center justify-between px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-white">
                      <Icon className="w-4 h-4" style={{ color: d.color }} fill={d.color} />
                      {d.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => bumpTrophy(d.key, -1)}
                        disabled={saving || n === 0}
                        className="w-6 h-6 flex items-center justify-center rounded bg-surface-2 border border-white/[0.07] text-muted hover:text-white disabled:opacity-30"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className={`w-5 text-center text-sm tabular-nums ${n > 0 ? "text-gold font-medium" : "text-muted"}`}>{n}</span>
                      <button
                        onClick={() => bumpTrophy(d.key, 1)}
                        disabled={saving}
                        className="w-6 h-6 flex items-center justify-center rounded bg-surface-2 border border-white/[0.07] text-muted hover:text-white disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 bg-surface-2 border-t border-white/[0.07] flex justify-end gap-2">
              <button
                onClick={() => setTrophyEditor(null)}
                disabled={saving}
                className="px-3 py-1.5 rounded text-xs text-muted hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={saveTrophies}
                disabled={saving}
                className="px-3 py-1.5 rounded text-xs bg-gold text-night font-medium disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
