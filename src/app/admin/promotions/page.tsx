"use client";

import { useState, useEffect } from "react";
import { ArrowUpDown, Loader2, Pencil } from "lucide-react";

interface Participant {
  userId: number;
  name: string;
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <ArrowUpDown className="w-6 h-6 text-gold" />
          Promotions / Relégations
        </h1>
        <p className="text-sm text-muted">Déplacer des participants entre les ligues</p>
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
    </div>
  );
}
