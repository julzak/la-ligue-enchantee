"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Save, Check, Lock } from "lucide-react";

interface ScoringConfig {
  goalBonusGk: number;
  goalBonusDef: number;
  goalBonusMid: number;
  goalBonusAtt: number;
  cscMalus: number;
  penaltySavedBonus: number;
  redCardNoteZero: number;
  minNote: number;
}

interface JokersConfig {
  regularCount: number;
  summerCount: number;
  summerDeadline: string;
}

interface MercatoHiverConfig {
  rankingMatchday: number | null;
  treveStart: string | null;
  treveEnd: string | null;
  // Gel des jokers pendant le mercato d'hiver (format datetime-local)
  jokersFreezeStart: string | null;
  jokersFreezeEnd: string | null;
}

interface DeadlinesConfig {
  defaultHour: number;
  earlyMatchHour: number;
  earlyMatchOffsetHours: number;
}

interface EffectifsInfo {
  footballDataToken: string | null; // masquée ("****abcd") ou null
  theSportsDbKey: string | null;
  theSportsDbKeySetAt: string | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function AdminConfigPage() {
  const [scoring, setScoring] = useState<ScoringConfig>({
    goalBonusGk: 10, goalBonusDef: 4, goalBonusMid: 2, goalBonusAtt: 2,
    cscMalus: -2, penaltySavedBonus: 2, redCardNoteZero: 1, minNote: 0,
  });
  const [jokers, setJokers] = useState<JokersConfig>({
    regularCount: 4, summerCount: 2, summerDeadline: "2025-09-15",
  });
  const [mercato, setMercato] = useState<MercatoHiverConfig>({
    rankingMatchday: null, treveStart: null, treveEnd: null,
    jokersFreezeStart: null, jokersFreezeEnd: null,
  });
  const [deadlines, setDeadlines] = useState<DeadlinesConfig>({
    defaultHour: 15, earlyMatchHour: 17, earlyMatchOffsetHours: 2,
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  // Bareme fige des qu'une journee est publiee (verrou serveur ; ici on adapte l'UI).
  const [seasonStarted, setSeasonStarted] = useState(false);
  // Confirmation lourde pour toucher au bareme (retaper "Configuration").
  const [scoringConfirmOpen, setScoringConfirmOpen] = useState(false);
  const [scoringConfirmText, setScoringConfirmText] = useState("");
  const [effectifs, setEffectifs] = useState<EffectifsInfo>({
    footballDataToken: null, theSportsDbKey: null, theSportsDbKeySetAt: null,
  });
  const [fdTokenInput, setFdTokenInput] = useState("");
  const [sdbKeyInput, setSdbKeyInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/config");
        const data = await res.json();
        if (data.scoring) setScoring(data.scoring);
        setSeasonStarted(data.seasonStarted === true);
        if (data.jokers) setJokers(data.jokers);
        if (data.mercatoHiver) setMercato(data.mercatoHiver);
        if (data.deadlines) setDeadlines(data.deadlines);
        if (data.effectifs) setEffectifs(data.effectifs);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function saveSection(section: string, data: unknown) {
    setSaveStatus((s) => ({ ...s, [section]: "saving" }));
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      });
      if (!res.ok) throw new Error();
      if (section === "effectifs") {
        const fresh = await fetch("/api/admin/config").then((r) => r.json()).catch(() => null);
        if (fresh?.effectifs) setEffectifs(fresh.effectifs);
        setFdTokenInput("");
        setSdbKeyInput("");
      }
      setSaveStatus((s) => ({ ...s, [section]: "saved" }));
      setTimeout(() => setSaveStatus((s) => ({ ...s, [section]: "idle" })), 2000);
    } catch {
      setSaveStatus((s) => ({ ...s, [section]: "error" }));
      setTimeout(() => setSaveStatus((s) => ({ ...s, [section]: "idle" })), 3000);
    }
  }

  function SaveButton({ section, data }: { section: string; data: unknown }) {
    const status = saveStatus[section] ?? "idle";
    return (
      <button
        onClick={() => saveSection(section, data)}
        disabled={status === "saving"}
        className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
          status === "saved"
            ? "bg-vert/20 text-vert"
            : status === "error"
            ? "bg-rouge/20 text-rouge"
            : "bg-gold/10 text-gold hover:bg-gold/20"
        }`}
      >
        {status === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === "saved" && <Check className="w-4 h-4" />}
        {status === "idle" && <Save className="w-4 h-4" />}
        {status === "error" && <Save className="w-4 h-4" />}
        {status === "saving" ? "Sauvegarde..." : status === "saved" ? "OK" : status === "error" ? "Erreur" : "Sauvegarder"}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Settings className="w-6 h-6 text-gold" />
          Configuration
        </h1>
        <p className="text-sm text-muted">Parametres de la saison courante</p>
      </div>

      {/* Section 0: Effectifs & photos (clés API, kick-off de saison) */}
      <section className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h2 className="font-serif text-base text-gold mb-1">Effectifs & photos (clés API)</h2>
        <p className="text-xs text-muted mb-4">
          Cf docs/kickoff-nouvelle-saison.md. Champ laissé vide = clé inchangée. Saisir CLEAR pour effacer.
        </p>
        {effectifs.theSportsDbKey && effectifs.theSportsDbKeySetAt && (
          <div className="mb-4 rounded border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
            Clé photos active (saisie le {effectifs.theSportsDbKeySetAt}) : pensez à RÉSILIER le
            Patreon TheSportsDB un mois après, sinon il refacture 9 $ chaque mois.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">
              Clé effectifs : token football-data.org (gratuit)
              {effectifs.footballDataToken && (
                <span className="ml-2 text-vert">configurée ({effectifs.footballDataToken})</span>
              )}
            </label>
            <input
              type="text"
              value={fdTokenInput}
              onChange={(e) => setFdTokenInput(e.target.value)}
              placeholder={effectifs.footballDataToken ? "Remplacer le token..." : "Coller le token football-data.org"}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">
              Clé photos : TheSportsDB premium (9 $/mois, au lancement seulement)
              {effectifs.theSportsDbKey && (
                <span className="ml-2 text-vert">configurée ({effectifs.theSportsDbKey})</span>
              )}
            </label>
            <input
              type="text"
              value={sdbKeyInput}
              onChange={(e) => setSdbKeyInput(e.target.value)}
              placeholder={effectifs.theSportsDbKey ? "Remplacer la clé..." : "Coller la clé TheSportsDB premium"}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <SaveButton section="effectifs" data={{ footballDataToken: fdTokenInput, theSportsDbKey: sdbKeyInput }} />
        </div>
      </section>

      {/* Section 1: Jokers */}
      <section className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h2 className="font-serif text-base text-gold mb-4">Jokers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Jokers reguliers"
            type="number"
            value={jokers.regularCount}
            onChange={(v) => setJokers({ ...jokers, regularCount: Number(v) })}
          />
          <Field
            label="Jokers d'aout"
            type="number"
            value={jokers.summerCount}
            onChange={(v) => setJokers({ ...jokers, summerCount: Number(v) })}
          />
          <Field
            label="Date limite jokers d'aout"
            type="date"
            value={jokers.summerDeadline}
            onChange={(v) => setJokers({ ...jokers, summerDeadline: v })}
            className="sm:col-span-2"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <SaveButton section="jokers" data={jokers} />
        </div>
      </section>

      {/* Section 2: Scoring (bareme) — editable seulement avant le debut de saison */}
      <section className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-serif text-base text-gold">Scoring (bareme)</h2>
          {seasonStarted && <Lock className="w-4 h-4 text-muted" />}
        </div>
        {seasonStarted ? (
          <p className="text-xs text-amber-400/90 mb-4">
            La saison a commence : le bareme est fige pour ne pas fausser le classement
            deja calcule. Il ne sera de nouveau modifiable qu&apos;avant la prochaine saison.
          </p>
        ) : (
          <p className="text-xs text-muted mb-4">
            Modifiable uniquement maintenant, avant la premiere journee publiee. Toute
            modification demande une confirmation.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field
            label="But gardien" type="number" value={scoring.goalBonusGk} prefix="+"
            disabled={seasonStarted}
            onChange={(v) => setScoring({ ...scoring, goalBonusGk: Number(v) })}
          />
          <Field
            label="But defenseur" type="number" value={scoring.goalBonusDef} prefix="+"
            disabled={seasonStarted}
            onChange={(v) => setScoring({ ...scoring, goalBonusDef: Number(v) })}
          />
          <Field
            label="But milieu" type="number" value={scoring.goalBonusMid} prefix="+"
            disabled={seasonStarted}
            onChange={(v) => setScoring({ ...scoring, goalBonusMid: Number(v) })}
          />
          <Field
            label="But attaquant" type="number" value={scoring.goalBonusAtt} prefix="+"
            disabled={seasonStarted}
            onChange={(v) => setScoring({ ...scoring, goalBonusAtt: Number(v) })}
          />
          <Field
            label="CSC" type="number" value={scoring.cscMalus}
            disabled={seasonStarted}
            onChange={(v) => setScoring({ ...scoring, cscMalus: Number(v) })}
          />
          <Field
            label="Penalty arrete" type="number" value={scoring.penaltySavedBonus} prefix="+"
            disabled={seasonStarted}
            onChange={(v) => setScoring({ ...scoring, penaltySavedBonus: Number(v) })}
          />
          <Field
            label="Note plancher" type="number" value={scoring.minNote}
            disabled={seasonStarted}
            onChange={(v) => setScoring({ ...scoring, minNote: Number(v) })}
          />
          <div>
            <label className="block text-xs text-muted mb-1">Carton rouge = note 0</label>
            <select
              value={scoring.redCardNoteZero}
              disabled={seasonStarted}
              onChange={(e) => setScoring({ ...scoring, redCardNoteZero: Number(e.target.value) })}
              className="w-full bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value={1}>Oui (note effacee, bonus conserves)</option>
              <option value={0}>Non (note conservee)</option>
            </select>
          </div>
        </div>
        {!seasonStarted && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => { setScoringConfirmText(""); setScoringConfirmOpen(true); }}
              disabled={(saveStatus.scoring ?? "idle") === "saving"}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
            >
              {(saveStatus.scoring ?? "idle") === "saved" ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {(saveStatus.scoring ?? "idle") === "saved" ? "OK" : "Sauvegarder le bareme"}
            </button>
          </div>
        )}
      </section>

      {/* Section 3: Mercato hiver */}
      <section className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h2 className="font-serif text-base text-gold mb-4">Mercato d&apos;hiver</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Journee de classement (budget)"
            type="number"
            value={mercato.rankingMatchday ?? ""}
            placeholder="Ex: 19"
            onChange={(v) => setMercato({ ...mercato, rankingMatchday: v ? Number(v) : null })}
          />
          <div />
          <Field
            label="Debut treve"
            type="date"
            value={mercato.treveStart ?? ""}
            onChange={(v) => setMercato({ ...mercato, treveStart: v || null })}
          />
          <Field
            label="Fin treve"
            type="date"
            value={mercato.treveEnd ?? ""}
            onChange={(v) => setMercato({ ...mercato, treveEnd: v || null })}
          />
          <Field
            label="Gel des jokers : debut"
            type="datetime-local"
            value={mercato.jokersFreezeStart ?? ""}
            onChange={(v) => setMercato({ ...mercato, jokersFreezeStart: v || null })}
          />
          <Field
            label="Gel des jokers : fin (reouverture)"
            type="datetime-local"
            value={mercato.jokersFreezeEnd ?? ""}
            onChange={(v) => setMercato({ ...mercato, jokersFreezeEnd: v || null })}
          />
        </div>
        <p className="text-xs text-muted mt-3">
          Les jokers sont bloqués du début à la fin du gel (heure du serveur, tolérance zéro).
          Une bannière prévient sur l&apos;accueil et les pages ligue 7 jours avant le début.
        </p>
        <div className="mt-4 flex justify-end">
          <SaveButton section="mercatoHiver" data={mercato} />
        </div>
      </section>

      {/* Section 4: Deadlines */}
      <section className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-base text-gold">Deadlines</h2>
          <SaveButton section="deadlines" data={deadlines} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field
            label="Heure de cloture par defaut"
            type="number"
            value={deadlines.defaultHour}
            onChange={(v) => setDeadlines({ ...deadlines, defaultHour: Number(v) })}
            prefix="h"
          />
          <Field
            label="Seuil match anticipe"
            type="number"
            value={deadlines.earlyMatchHour}
            onChange={(v) => setDeadlines({ ...deadlines, earlyMatchHour: Number(v) })}
            prefix="h"
          />
          <Field
            label="Heures avant coup d'envoi"
            type="number"
            value={deadlines.earlyMatchOffsetHours}
            onChange={(v) => setDeadlines({ ...deadlines, earlyMatchOffsetHours: Number(v) })}
            prefix="h"
          />
        </div>
        <p className="text-xs text-muted mt-3">
          Cloture a {deadlines.defaultHour}h le jour du match. Si match avant {deadlines.earlyMatchHour}h, cloture {deadlines.earlyMatchOffsetHours}h avant le coup d&apos;envoi. Override ponctuel dans la page Notes.
        </p>
      </section>

      {/* Modale de confirmation lourde du bareme */}
      {scoringConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface border border-white/10 rounded-lg p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <h3 className="font-serif text-lg text-white">Confirmer la modification du bareme</h3>
            </div>
            <p className="text-sm text-muted">
              Le bareme pilote le calcul du classement de toute la saison. Il ne pourra
              plus etre modifie une fois la premiere journee publiee. Pour confirmer,
              retapez <span className="text-white font-medium">Configuration</span> ci-dessous.
            </p>
            <input
              type="text"
              autoFocus
              value={scoringConfirmText}
              onChange={(e) => setScoringConfirmText(e.target.value)}
              placeholder="Configuration"
              className="w-full bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setScoringConfirmOpen(false)}
                className="px-4 py-2 rounded text-sm text-muted hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                disabled={scoringConfirmText !== "Configuration"}
                onClick={() => {
                  setScoringConfirmOpen(false);
                  saveSection("scoring", scoring);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, type, value, onChange, prefix, placeholder, className, disabled,
}: {
  label: string;
  type: "number" | "date" | "datetime-local";
  value: string | number;
  onChange: (v: string) => void;
  prefix?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 disabled:opacity-50 disabled:cursor-not-allowed ${
            prefix ? "pl-7" : ""
          }`}
        />
      </div>
    </div>
  );
}
