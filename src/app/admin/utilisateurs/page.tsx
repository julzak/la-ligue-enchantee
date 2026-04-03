"use client";

import { useState, useEffect } from "react";
import { Shield, Loader2, Trash2, Plus } from "lucide-react";

interface AdminUser {
  userId: number;
  name: string;
}

interface UserOption {
  id: number;
  name: string;
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setAdmins(data.admins ?? []);
      setAllUsers(data.allUsers ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addAdmin() {
    if (!selectedUserId) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Admin ajouté");
        setSelectedUserId(0);
        await loadData();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setSaving(false);
  }

  async function removeAdmin(userId: number) {
    if (!confirm("Retirer cet administrateur ?")) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Admin retiré");
        await loadData();
      } else {
        setMessage("Erreur: " + data.error);
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setSaving(false);
  }

  // Filter out users already admin from dropdown
  const adminIds = new Set(admins.map((a) => a.userId));
  const nonAdminUsers = allUsers
    .filter((u) => !adminIds.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Shield className="w-6 h-6 text-gold" />
          Administrateurs
        </h1>
        <p className="text-sm text-muted">Gérer les droits d&apos;accès à l&apos;interface d&apos;administration</p>
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
        <>
          {/* Current admins */}
          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
            <div className="bg-surface-2 px-4 py-2 border-b border-white/[0.07]">
              <span className="text-sm text-white font-medium">{admins.length} administrateurs</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {admins.map((a) => (
                <div key={a.userId} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">{a.name}</span>
                    <span className="text-[10px] text-muted">#{a.userId}</span>
                  </div>
                  <button
                    onClick={() => removeAdmin(a.userId)}
                    disabled={saving}
                    className="text-xs text-muted hover:text-rouge flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add admin */}
          <div className="flex items-center gap-3">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="flex-1 bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
            >
              <option value={0}>Ajouter un administrateur...</option>
              {nonAdminUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} (#{u.id})</option>
              ))}
            </select>
            <button
              onClick={addAdmin}
              disabled={!selectedUserId || saving}
              className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </button>
          </div>
        </>
      )}
    </div>
  );
}
