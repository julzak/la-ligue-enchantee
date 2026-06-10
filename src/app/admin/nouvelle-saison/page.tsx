"use client";

import { useState } from "react";
import SeasonManager from "./SeasonManager";

const POSITIONS = ["Gardien", "Défense", "Milieu", "Attaque"] as const;
type Position = (typeof POSITIONS)[number];

interface Season {
  id: number;
  label: string;
  status: string;
}
interface ApiClub {
  externalId: string;
  name: string;
  badgeUrl: string | null;
}
interface SquadPlayer {
  externalId: string;
  fname: string;
  lname: string;
  position: Position;
}
interface ClubState extends ApiClub {
  selected: boolean;
  squadLoaded: boolean;
  squadLoading: boolean;
  players: SquadPlayer[];
}
interface LeagueRow {
  name: string;
  divisionLabel: string;
  tier: number;
}
interface ParticipantLeague {
  id: number;
  name: string;
  tier: number | null;
}
interface AdminUser {
  id: number;
  name: string;
  email: string;
}

const btn = "rounded bg-gold px-4 py-2 text-sm font-medium text-night hover:bg-gold-dim disabled:opacity-40 disabled:cursor-not-allowed";
const btnGhost = "rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-2 disabled:opacity-40";
const input = "rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold";

export default function NouvelleSaisonPage() {
  const [step, setStep] = useState(1);
  const [season, setSeason] = useState<Season | null>(null);
  const [error, setError] = useState("");

  // Étape 1
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Étape 2
  const [clubs, setClubs] = useState<ClubState[]>([]);
  const [clubsSource, setClubsSource] = useState<string>("");
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>("");

  // Étape 3
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [prefillLabel, setPrefillLabel] = useState<string | null>(null);
  const [savingLeagues, setSavingLeagues] = useState(false);
  const [leaguesSaved, setLeaguesSaved] = useState(false);

  // Étape 4 : participants
  const [pLeagues, setPLeagues] = useState<ParticipantLeague[]>([]);
  const [pAssignments, setPAssignments] = useState<Record<number, number[]>>({});
  const [pUsers, setPUsers] = useState<AdminUser[]>([]);
  const [pPrefill, setPPrefill] = useState<Record<number, number[]> | null>(null);
  const [pPrevLabel, setPPrevLabel] = useState<string | null>(null);
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [participantsSaved, setParticipantsSaved] = useState<string>("");

  // ── Étape 1 ────────────────────────────────────────────────────────────
  async function createSeason() {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setSeason(data.season);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  // ── Étape 2 ────────────────────────────────────────────────────────────
  async function fetchClubs() {
    setError("");
    setLoadingClubs(true);
    try {
      const res = await fetch("/api/admin/seasons/clubs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setClubsSource(data.source);
      setClubs(
        (data.clubs as ApiClub[]).map((c) => ({
          ...c,
          selected: true,
          squadLoaded: false,
          squadLoading: false,
          players: [],
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoadingClubs(false);
    }
  }

  function toggleClub(externalId: string) {
    setClubs((prev) =>
      prev.map((c) => (c.externalId === externalId ? { ...c, selected: !c.selected } : c))
    );
  }

  async function loadSquad(externalId: string) {
    setError("");
    setClubs((prev) =>
      prev.map((c) => (c.externalId === externalId ? { ...c, squadLoading: true } : c))
    );
    try {
      const res = await fetch(
        `/api/admin/seasons/squad?clubExternalId=${encodeURIComponent(externalId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setClubs((prev) =>
        prev.map((c) =>
          c.externalId === externalId
            ? { ...c, squadLoaded: true, squadLoading: false, players: data.players }
            : c
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setClubs((prev) =>
        prev.map((c) => (c.externalId === externalId ? { ...c, squadLoading: false } : c))
      );
    }
  }

  function setPlayerPosition(clubId: string, playerId: string, position: Position) {
    setClubs((prev) =>
      prev.map((c) =>
        c.externalId === clubId
          ? {
              ...c,
              players: c.players.map((p) =>
                p.externalId === playerId ? { ...p, position } : p
              ),
            }
          : c
      )
    );
  }

  async function importToDb() {
    if (!season) return;
    setError("");
    setImporting(true);
    setImportResult("");
    try {
      const payload = {
        seasonId: season.id,
        clubs: clubs
          .filter((c) => c.selected)
          .map((c) => ({
            externalId: c.externalId,
            name: c.name,
            players: c.players.map((p) => ({
              fname: p.fname,
              lname: p.lname,
              position: p.position,
            })),
          })),
      };
      const res = await fetch("/api/admin/seasons/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setImportResult(`${data.clubCount} clubs et ${data.playerCount} joueurs importés.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setImporting(false);
    }
  }

  // ── Étape 3 ────────────────────────────────────────────────────────────
  async function goToLeagues() {
    if (!season) return;
    setStep(3);
    setError("");
    try {
      const res = await fetch(`/api/admin/seasons/leagues?seasonId=${season.id}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.prefill) && data.prefill.length > 0) {
        setPrefillLabel(data.prevSeasonLabel);
      }
    } catch {
      /* prefill optionnel */
    }
  }

  async function applyPrefill() {
    if (!season) return;
    const res = await fetch(`/api/admin/seasons/leagues?seasonId=${season.id}`);
    const data = await res.json();
    if (res.ok && Array.isArray(data.prefill)) {
      setLeagues(data.prefill);
    }
  }

  function addLeague() {
    setLeagues((prev) => [
      ...prev,
      { name: "", divisionLabel: "", tier: prev.length + 1 },
    ]);
  }
  function updateLeague(idx: number, patch: Partial<LeagueRow>) {
    setLeagues((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLeague(idx: number) {
    setLeagues((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveLeagues() {
    if (!season) return;
    setError("");
    setSavingLeagues(true);
    try {
      const res = await fetch("/api/admin/seasons/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id, leagues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setLeaguesSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSavingLeagues(false);
    }
  }

  // ── Étape 4 : participants ─────────────────────────────────────────────
  async function goToParticipants() {
    if (!season) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/seasons/participants?seasonId=${season.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setPLeagues(data.leagues);
      setPUsers(data.users);
      setPPrevLabel(data.prevSeasonLabel);
      const currentMap: Record<number, number[]> = {};
      for (const c of data.current as { leagueId: number; userIds: number[] }[]) {
        currentMap[c.leagueId] = c.userIds;
      }
      setPAssignments(currentMap);
      if (Array.isArray(data.prefill) && data.prefill.length > 0) {
        const prefillMap: Record<number, number[]> = {};
        for (const p of data.prefill as { leagueId: number; userIds: number[] }[]) {
          prefillMap[p.leagueId] = p.userIds;
        }
        setPPrefill(prefillMap);
      }
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  function applyParticipantsPrefill() {
    if (pPrefill) setPAssignments(pPrefill);
  }

  // Recharge uniquement la liste des comptes (après création d'un compte
  // dans Admin → Utilisateurs), sans toucher aux affectations en cours.
  async function refreshUsers() {
    if (!season) return;
    try {
      const res = await fetch(`/api/admin/seasons/participants?seasonId=${season.id}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) setPUsers(data.users);
    } catch {
      /* silencieux */
    }
  }

  function addParticipant(leagueId: number, userId: number) {
    setPAssignments((prev) => {
      // Retire le user des autres ligues (1 ligue max par participant)
      const next: Record<number, number[]> = {};
      for (const [lid, ids] of Object.entries(prev)) {
        next[Number(lid)] = ids.filter((id) => id !== userId);
      }
      next[leagueId] = [...(next[leagueId] ?? []), userId];
      return next;
    });
  }

  function removeParticipant(leagueId: number, userId: number) {
    setPAssignments((prev) => ({
      ...prev,
      [leagueId]: (prev[leagueId] ?? []).filter((id) => id !== userId),
    }));
  }

  async function saveParticipants() {
    if (!season) return;
    setError("");
    setSavingParticipants(true);
    setParticipantsSaved("");
    try {
      const assignments = pLeagues.map((l) => ({
        leagueId: l.id,
        userIds: pAssignments[l.id] ?? [],
      }));
      const res = await fetch("/api/admin/seasons/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id, assignments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setParticipantsSaved(`${data.participantCount} participants inscrits.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSavingParticipants(false);
    }
  }

  // Défaut de la Ligue Enchantée : 3 ligues (Ligue 1/2/3). Labels éditables.
  function applyDefaultLeagues() {
    setLeagues([
      { name: "Ligue 1", divisionLabel: "Ligue 1", tier: 1 },
      { name: "Ligue 2", divisionLabel: "Ligue 2", tier: 2 },
      { name: "Ligue 3", divisionLabel: "Ligue 3", tier: 3 },
    ]);
  }

  const selectedCount = clubs.filter((c) => c.selected).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Démarrer une nouvelle saison</h1>
        <p className="text-sm text-muted">
          Crée la saison, importe clubs et joueurs, puis configure les divisions.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <SeasonManager />
      </div>

      <hr className="border-border" />
      <h2 className="font-serif text-base text-gold">Créer une nouvelle saison</h2>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, label: "Création" },
          { n: 2, label: "Clubs & joueurs" },
          { n: 3, label: "Ligues" },
          { n: 4, label: "Participants" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                step >= s.n ? "bg-gold text-night" : "bg-surface-2 text-muted"
              }`}
            >
              {s.n}
            </span>
            <span className={step >= s.n ? "text-foreground" : "text-muted"}>{s.label}</span>
            {i < 3 && <span className="mx-1 text-muted">→</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded border border-rouge/40 bg-rouge/10 px-3 py-2 text-sm text-rouge">
          {error}
        </div>
      )}

      {/* ÉTAPE 1 */}
      {step === 1 && (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5">
          <label className="block text-sm text-foreground">
            Label de la saison
            <input
              className={`mt-1 block w-48 ${input}`}
              placeholder="2026-2027"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <button className={btn} onClick={createSeason} disabled={creating || !label.trim()}>
            {creating ? "Création..." : "Créer la saison"}
          </button>
        </div>
      )}

      {/* ÉTAPE 2 */}
      {step === 2 && season && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">
                Saison <span className="font-semibold text-gold">{season.label}</span> créée.
                Récupère les clubs de Ligue 1.
              </p>
              <button className={btnGhost} onClick={fetchClubs} disabled={loadingClubs}>
                {loadingClubs ? "Chargement..." : "Récupérer les clubs de Ligue 1"}
              </button>
            </div>
            {clubsSource && (
              <p className="text-xs text-muted">
                Source : {clubsSource === "mock" ? "données simulées (mock)" : "API live"} ·{" "}
                {selectedCount}/{clubs.length} clubs sélectionnés
              </p>
            )}
          </div>

          {clubs.map((club) => (
            <div key={club.externalId} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={club.selected}
                    onChange={() => toggleClub(club.externalId)}
                  />
                  <span className="font-medium">{club.name}</span>
                </label>
                <button
                  className={btnGhost}
                  onClick={() => loadSquad(club.externalId)}
                  disabled={!club.selected || club.squadLoading}
                >
                  {club.squadLoading
                    ? "Chargement..."
                    : club.squadLoaded
                    ? "Recharger l'effectif"
                    : "Charger l'effectif"}
                </button>
              </div>

              {club.squadLoaded && club.players.length > 0 && (
                <div className="mt-3 grid gap-1.5">
                  {club.players.map((p) => (
                    <div
                      key={p.externalId}
                      className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm"
                    >
                      <span className="text-foreground/90">
                        {p.fname} {p.lname}
                      </span>
                      <select
                        className={`${input} py-1`}
                        value={p.position}
                        onChange={(e) =>
                          setPlayerPosition(
                            club.externalId,
                            p.externalId,
                            e.target.value as Position
                          )
                        }
                      >
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {clubs.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                className={btn}
                onClick={importToDb}
                disabled={importing || selectedCount === 0}
              >
                {importing ? "Import..." : `Importer en base (${selectedCount} clubs)`}
              </button>
              {importResult && (
                <span className="text-sm text-foreground">{importResult}</span>
              )}
              {importResult && (
                <button className={btnGhost} onClick={goToLeagues}>
                  Étape suivante : créer les ligues →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ÉTAPE 3 */}
      {step === 3 && season && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
            <p className="text-sm text-foreground">
              Configure les divisions de la saison{" "}
              <span className="font-semibold text-gold">{season.label}</span>. Les labels et le
              niveau hiérarchique (tier 1 = division la plus haute) sont libres.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button className={btnGhost} onClick={applyDefaultLeagues}>
                Pré-remplir 3 ligues (Ligue 1/2/3)
              </button>
              <button className={btnGhost} onClick={addLeague}>
                + Ajouter une ligue
              </button>
              {prefillLabel && (
                <button className={btnGhost} onClick={applyPrefill}>
                  Reprendre depuis {prefillLabel}
                </button>
              )}
            </div>
          </div>

          {leagues.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_5rem_2.5rem] gap-2 px-1 text-xs text-muted">
                <span>Nom interne</span>
                <span>Label division</span>
                <span>Tier</span>
                <span></span>
              </div>
              {leagues.map((l, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_1fr_5rem_2.5rem] items-center gap-2"
                >
                  <input
                    className={input}
                    placeholder="ex: Ligue 1"
                    value={l.name}
                    onChange={(e) => updateLeague(idx, { name: e.target.value })}
                  />
                  <input
                    className={input}
                    placeholder="ex: L1"
                    value={l.divisionLabel}
                    onChange={(e) => updateLeague(idx, { divisionLabel: e.target.value })}
                  />
                  <input
                    type="number"
                    min={1}
                    className={input}
                    value={l.tier}
                    onChange={(e) =>
                      updateLeague(idx, { tier: parseInt(e.target.value, 10) || 1 })
                    }
                  />
                  <button
                    className="text-muted hover:text-rouge"
                    onClick={() => removeLeague(idx)}
                    aria-label="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              className={btn}
              onClick={saveLeagues}
              disabled={savingLeagues || leagues.length === 0}
            >
              {savingLeagues ? "Enregistrement..." : "Créer les ligues"}
            </button>
            {leaguesSaved && (
              <>
                <span className="text-sm text-foreground">Ligues créées.</span>
                <button className={btnGhost} onClick={goToParticipants}>
                  Étape suivante : inscrire les participants →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ÉTAPE 4 : PARTICIPANTS */}
      {step === 4 && season && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
            <p className="text-sm text-foreground">
              Inscris les participants dans chaque ligue de la saison{" "}
              <span className="font-semibold text-gold">{season.label}</span>. Les ligues sont
              par affinité : pars des participants de la saison précédente puis ajuste.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {pPrefill && pPrevLabel && (
                <button className={btnGhost} onClick={applyParticipantsPrefill}>
                  Reprendre les participants de {pPrevLabel}
                </button>
              )}
              <button
                className={btnGhost}
                onClick={refreshUsers}
                title="À utiliser après avoir créé un compte dans Admin → Utilisateurs"
              >
                Actualiser la liste des comptes
              </button>
            </div>
            <p className="text-xs text-muted">
              Un participant absent de la liste n&apos;a pas encore de compte : crée-le dans
              Admin → Utilisateurs (mot de passe initial &quot;ligue&quot;), puis actualise ici.
            </p>
          </div>

          {pLeagues.map((league) => {
            const memberIds = pAssignments[league.id] ?? [];
            const members = memberIds
              .map((id) => pUsers.find((u) => u.id === id))
              .filter((u): u is AdminUser => Boolean(u));
            const assignedElsewhere = new Set(
              Object.entries(pAssignments)
                .filter(([lid]) => Number(lid) !== league.id)
                .flatMap(([, ids]) => ids)
            );
            const available = pUsers.filter(
              (u) => !memberIds.includes(u.id) && !assignedElsewhere.has(u.id)
            );
            return (
              <div key={league.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{league.name}</span>
                  <span className="text-xs text-muted">{members.length} participants</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-foreground"
                    >
                      {u.name}
                      <button
                        className="text-muted hover:text-rouge"
                        onClick={() => removeParticipant(league.id, u.id)}
                        aria-label={`Retirer ${u.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-muted">Aucun participant inscrit.</span>
                  )}
                </div>
                <select
                  className={`${input} py-1.5`}
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id) addParticipant(league.id, id);
                  }}
                >
                  <option value="">+ Ajouter un participant...</option>
                  {available.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          <div className="flex items-center gap-3">
            <button
              className={btn}
              onClick={saveParticipants}
              disabled={savingParticipants || pLeagues.length === 0}
            >
              {savingParticipants ? "Enregistrement..." : "Enregistrer les participants"}
            </button>
            {participantsSaved && (
              <span className="text-sm text-foreground">
                {participantsSaved} La saison <span className="text-gold">{season.label}</span>{" "}
                est prête : ouvre les enchères puis démarre-la depuis « Saisons existantes »
                en haut de page.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
