"use client";

import { useEffect, useState } from "react";

// Outils effectifs/photos du kick-off (phases 6bis et 8 du runbook) :
// récupération des photos des joueurs sélectionnés + rafraîchissement
// incrémental de l'effectif d'un club (recrues du mercato).

interface Season {
  id: number;
  label: string;
  status: string;
  isCurrent: boolean;
}
interface ClubOption {
  id: number;
  name: string;
}
interface Unmatched {
  playerId: number;
  name: string;
  clubName: string;
}

const btn = "rounded bg-gold px-4 py-2 text-sm font-medium text-night hover:bg-gold-dim disabled:opacity-40 disabled:cursor-not-allowed";
const btnGhost = "rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-2 disabled:opacity-40";
const input = "rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold";

export default function EffectifsTools() {
  const [season, setSeason] = useState<Season | null>(null);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [manualUrls, setManualUrls] = useState<Record<number, string>>({});
  const [refreshClubId, setRefreshClubId] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/seasons");
        const data = await res.json();
        const seasons: Season[] = data.seasons ?? [];
        // Saison de travail : la courante, sinon la plus récente non clôturée.
        const target =
          seasons.find((s) => s.isCurrent) ??
          seasons.find((s) => s.status !== "CLOSED") ??
          null;
        setSeason(target);
        if (target) {
          const clubRes = await fetch(`/api/admin/seasons/clubs-list?seasonId=${target.id}`);
          if (clubRes.ok) {
            const clubData = await clubRes.json();
            setClubs(clubData.clubs ?? []);
          }
        }
      } catch {
        /* silencieux */
      }
    })();
  }, []);

  async function syncPhotos(allPlayers: boolean) {
    if (!season) return;
    setBusy(true);
    setErr("");
    setMsg(`Récupération des photos en cours (peut prendre 1 à 3 minutes)...`);
    setUnmatched([]);
    try {
      const res = await fetch("/api/admin/seasons/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id, allPlayers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setMsg(data.message);
      setUnmatched(data.report?.unmatched ?? []);
    } catch (e) {
      setMsg("");
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function setManualPhoto(playerId: number) {
    const url = (manualUrls[playerId] ?? "").trim();
    if (!url) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/seasons/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setUnmatched((prev) => prev.filter((u) => u.playerId !== playerId));
      setMsg(`Photo enregistrée (copiée en local).`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function refreshClub() {
    if (!season || !refreshClubId) return;
    setBusy(true);
    setErr("");
    setMsg("Rafraîchissement de l'effectif...");
    try {
      const res = await fetch("/api/admin/seasons/refresh-club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id, clubId: refreshClubId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setMsg(data.message);
    } catch (e) {
      setMsg("");
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (!season) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <div>
        <h2 className="font-serif text-base text-gold">Effectifs & photos — saison {season.label}</h2>
        <p className="text-xs text-muted">
          Photos : après les enchères, équipes constituées (phase 6bis du guide). Recrues : pendant
          le mercato (phase 8). Clés API dans Admin → Configuration.
        </p>
      </div>

      {msg && <div className="rounded bg-gold/10 px-3 py-2 text-sm text-gold">{msg}</div>}
      {err && <div className="rounded border border-rouge/40 bg-rouge/10 px-3 py-2 text-sm text-rouge">{err}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => syncPhotos(false)} disabled={busy}>
          Récupérer les photos des équipes
        </button>
        <button
          className={btnGhost}
          onClick={() => syncPhotos(true)}
          disabled={busy}
          title="Recette uniquement : télécharge les photos de TOUS les joueurs de la saison, pas seulement ceux en équipe"
        >
          Tous les joueurs (recette)
        </button>
      </div>

      {unmatched.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            Joueurs sans photo trouvée ({unmatched.length}) : coller une URL d&apos;image pour corriger
            (elle sera copiée en local), ou laisser l&apos;avatar à initiales.
          </p>
          {unmatched.map((u) => (
            <div key={u.playerId} className="grid grid-cols-[14rem_1fr_auto] items-center gap-2">
              <span className="truncate text-sm text-foreground/90" title={`${u.name} (${u.clubName})`}>
                {u.name} <span className="text-muted">({u.clubName})</span>
              </span>
              <input
                className={input}
                placeholder="https://... (URL d'une photo)"
                value={manualUrls[u.playerId] ?? ""}
                onChange={(e) => setManualUrls((prev) => ({ ...prev, [u.playerId]: e.target.value }))}
              />
              <button
                className={btnGhost}
                onClick={() => setManualPhoto(u.playerId)}
                disabled={busy || !(manualUrls[u.playerId] ?? "").trim()}
              >
                Enregistrer
              </button>
            </div>
          ))}
        </div>
      )}

      <hr className="border-border" />

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${input} py-1.5`}
          value={refreshClubId}
          onChange={(e) => setRefreshClubId(Number(e.target.value))}
        >
          <option value={0}>Rafraîchir l&apos;effectif d&apos;un club (recrues)...</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className={btnGhost} onClick={refreshClub} disabled={busy || !refreshClubId}>
          Rafraîchir
        </button>
        <span className="text-xs text-muted">
          Ajoute uniquement les nouveaux joueurs, ne touche à rien d&apos;existant.
        </span>
      </div>
    </div>
  );
}
