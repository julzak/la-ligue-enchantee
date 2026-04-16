"use client";

import { useState, useEffect } from "react";
import { UserPlus, Search, Pencil, Check, X, Loader2 } from "lucide-react";

interface Player {
  id: number;
  fname: string;
  lname: string;
  position: string;
  clubId: number;
  clubName: string;
}

interface Club {
  id: number;
  name: string;
}

const POSITIONS = ["Gardien", "Défense", "Milieu", "Attaque"];

export default function AdminJoueursPage() {
  // Clubs list
  const [clubs, setClubs] = useState<Club[]>([]);

  // Create form
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [position, setPosition] = useState("Attaque");
  const [clubId, setClubId] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // Search + edit
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editFname, setEditFname] = useState("");
  const [editLname, setEditLname] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch clubs on mount
  useEffect(() => {
    fetch("/api/admin/players?list=clubs")
      .then((r) => r.json())
      .then((d) => {
        const list: Club[] = d.clubs ?? [];
        setClubs(list);
        const legion = list.find((c) => c.name.toLowerCase().includes("gion"));
        if (legion) setClubId(legion.id);
      })
      .catch(() => {});
  }, []);

  // Search players
  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/players?search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.players ?? []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg("");
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fname, lname, position, clubId: clubId || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreateMsg(`Joueur cree : ${data.player.fname} ${data.player.lname} (#${data.player.id})`);
        setFname("");
        setLname("");
        // Refresh search if active
        if (search.length >= 2) setSearch((s) => s + " ");
        setTimeout(() => { if (search.length >= 2) setSearch(search); }, 100);
      } else {
        setCreateMsg("Erreur : " + data.error);
      }
    } catch {
      setCreateMsg("Erreur reseau");
    }
    setCreating(false);
  }

  function startEdit(p: Player) {
    setEditId(p.id);
    setEditFname(p.fname);
    setEditLname(p.lname);
    setEditPosition(p.position);
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/players", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, fname: editFname, lname: editLname, position: editPosition }),
      });
      const data = await res.json();
      if (data.ok) {
        setResults((prev) =>
          prev.map((p) =>
            p.id === editId ? { ...p, fname: editFname.trim(), lname: editLname.trim(), position: editPosition } : p
          )
        );
        setEditId(null);
      }
    } catch {}
    setSaving(false);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-gold" />
          Gestion des joueurs
        </h1>
        <p className="text-sm text-muted">
          Créer des joueurs (n&apos;importe quel club) ou corriger des noms/postes.
        </p>
      </div>

      {/* Create section */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h2 className="text-sm font-medium text-white mb-4">Nouveau joueur</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Prenom</label>
            <input
              type="text"
              value={fname}
              onChange={(e) => setFname(e.target.value)}
              className="w-40 h-9 bg-surface-2 border border-white/[0.07] rounded px-3 text-sm text-white focus:outline-none focus:border-gold"
              placeholder="Prenom"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Nom</label>
            <input
              type="text"
              value={lname}
              onChange={(e) => setLname(e.target.value)}
              className="w-40 h-9 bg-surface-2 border border-white/[0.07] rounded px-3 text-sm text-white focus:outline-none focus:border-gold"
              placeholder="Nom"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Poste</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="h-9 bg-surface-2 border border-white/[0.07] rounded px-3 text-sm text-white focus:outline-none focus:border-gold"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Club</label>
            <select
              value={clubId}
              onChange={(e) => setClubId(Number(e.target.value))}
              className="h-9 bg-surface-2 border border-white/[0.07] rounded px-3 text-sm text-white focus:outline-none focus:border-gold"
            >
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || !fname.trim() || !lname.trim()}
            className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Creer
          </button>
        </form>
        {createMsg && (
          <p className={`mt-3 text-sm ${createMsg.includes("Erreur") ? "text-rouge" : "text-vert"}`}>
            {createMsg}
          </p>
        )}
      </div>

      {/* Search + edit section */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h2 className="text-sm font-medium text-white mb-4">Rechercher / Modifier un joueur</h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 bg-surface-2 border border-white/[0.07] rounded pl-9 pr-3 text-sm text-white focus:outline-none focus:border-gold"
            placeholder="Rechercher par nom (min. 2 caracteres)..."
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted" />}
        </div>

        {results.length > 0 && (
          <div className="border border-white/[0.07] rounded overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[8rem_10rem_7rem_8rem_2.5rem] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted bg-surface-2 border-b border-white/[0.05]">
              <span>Prenom</span>
              <span>Nom</span>
              <span>Poste</span>
              <span>Club</span>
              <span />
            </div>
            {results.map((p) => (
              <div key={p.id} className="grid grid-cols-[8rem_10rem_7rem_8rem_2.5rem] gap-2 px-3 py-1.5 items-center border-b border-white/[0.04] last:border-b-0">
                {editId === p.id ? (
                  <>
                    <input
                      type="text"
                      value={editFname}
                      onChange={(e) => setEditFname(e.target.value)}
                      className="h-7 bg-surface-2 border border-gold/30 rounded px-2 text-xs text-white focus:outline-none focus:border-gold"
                    />
                    <input
                      type="text"
                      value={editLname}
                      onChange={(e) => setEditLname(e.target.value)}
                      className="h-7 bg-surface-2 border border-gold/30 rounded px-2 text-xs text-white focus:outline-none focus:border-gold"
                    />
                    <select
                      value={editPosition}
                      onChange={(e) => setEditPosition(e.target.value)}
                      className="h-7 bg-surface-2 border border-gold/30 rounded px-1 text-xs text-white focus:outline-none focus:border-gold"
                    >
                      {POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <button onClick={saveEdit} disabled={saving} className="p-1 text-vert hover:text-vert/80" title="Sauvegarder">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-rouge hover:text-rouge/80" title="Annuler">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span />
                  </>
                ) : (
                  <>
                    <span className="text-xs text-white truncate">{p.fname}</span>
                    <span className="text-xs text-white truncate">{p.lname}</span>
                    <span className="text-xs text-muted">{p.position}</span>
                    <span className="text-xs text-muted truncate">{p.clubName}</span>
                    <button onClick={() => startEdit(p)} className="p-1 text-white/30 hover:text-gold transition-colors" title="Modifier">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {search.length >= 2 && results.length === 0 && !searching && (
          <p className="text-sm text-muted text-center py-4">Aucun joueur trouve</p>
        )}
      </div>
    </div>
  );
}
