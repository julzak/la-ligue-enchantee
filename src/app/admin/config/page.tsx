"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Save, Check } from "lucide-react";

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
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/config");
        const data = await res.json();
        if (data.scoring) setScoring(data.scoring);
        if (data.jokers) setJokers(data.jokers);
        if (data.mercatoHiver) setMercato(data.mercatoHiver);
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
        <p className="text-sm text-muted">Parametres de la saison 2025-2026</p>
      </div>

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

      {/* Section 2: Scoring */}
      <section className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h2 className="font-serif text-base text-gold mb-4">Scoring</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field
            label="But gardien"
            type="number"
            value={scoring.goalBonusGk}
            prefix="+"
            onChange={(v) => setScoring({ ...scoring, goalBonusGk: Number(v) })}
          />
          <Field
            label="But defenseur"
            type="number"
            value={scoring.goalBonusDef}
            prefix="+"
            onChange={(v) => setScoring({ ...scoring, goalBonusDef: Number(v) })}
          />
          <Field
            label="But milieu"
            type="number"
            value={scoring.goalBonusMid}
            prefix="+"
            onChange={(v) => setScoring({ ...scoring, goalBonusMid: Number(v) })}
          />
          <Field
            label="But attaquant"
            type="number"
            value={scoring.goalBonusAtt}
            prefix="+"
            onChange={(v) => setScoring({ ...scoring, goalBonusAtt: Number(v) })}
          />
          <Field
            label="CSC"
            type="number"
            value={scoring.cscMalus}
            onChange={(v) => setScoring({ ...scoring, cscMalus: Number(v) })}
          />
          <Field
            label="Penalty arrete"
            type="number"
            value={scoring.penaltySavedBonus}
            prefix="+"
            onChange={(v) => setScoring({ ...scoring, penaltySavedBonus: Number(v) })}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <SaveButton section="scoring" data={scoring} />
        </div>
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
        </div>
        <div className="mt-4 flex justify-end">
          <SaveButton section="mercatoHiver" data={mercato} />
        </div>
      </section>

      {/* Section 4: Deadlines (read-only) */}
      <section className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h2 className="font-serif text-base text-gold mb-4">Deadlines</h2>
        <div className="text-sm text-white/70 space-y-2">
          <p>15h tous les jours (lundi au dimanche)</p>
          <p>2h avant le coup d&apos;envoi si match avant 17h</p>
          <p className="text-xs text-muted mt-2">
            Modifiable manuellement dans la page Notes (champ date/heure a cote du selecteur de journee).
          </p>
        </div>
      </section>
    </div>
  );
}

function Field({
  label, type, value, onChange, prefix, placeholder, className,
}: {
  label: string;
  type: "number" | "date";
  value: string | number;
  onChange: (v: string) => void;
  prefix?: string;
  placeholder?: string;
  className?: string;
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
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 ${
            prefix ? "pl-7" : ""
          }`}
        />
      </div>
    </div>
  );
}
