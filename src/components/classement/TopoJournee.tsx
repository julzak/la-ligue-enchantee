"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";

interface TopoJourneeProps {
  matchday: number;
  leagueName: string;
  slug: string;
}

export function TopoJournee({ matchday, slug }: TopoJourneeProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Auto-load saved topo on mount
  useEffect(() => {
    async function loadTopo() {
      try {
        const res = await fetch(`/api/topo?slug=${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.topo) {
            setContent(data.topo);
          }
        }
      } catch {
        // silent fail
      }
      setLoading(false);
    }
    loadTopo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateTopo() {
    setGenerating(true);
    try {
      const res = await fetch("/api/topo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data.topo);
      }
    } catch {
      // silent fail
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <h3 className="font-serif text-sm text-gold">Journée {matchday} : la synthèse de Lia 🤖</h3>
          <Loader2 className="w-3 h-3 animate-spin text-muted ml-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <Sparkles className="w-4 h-4 text-gold" />
        <h3 className="font-serif text-sm text-gold">Journée {matchday} : la synthèse de Lia 🤖</h3>
        {!content && (
          <button
            onClick={generateTopo}
            disabled={generating}
            className="ml-auto text-[10px] uppercase tracking-wider text-gold/60 hover:text-gold bg-surface-2 hover:bg-gold/10 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Générer avec l'IA"}
          </button>
        )}
      </div>
      <div className="px-5 pb-4">
        {content ? (
          <>
            <p className="text-sm text-white/75 leading-relaxed italic">
              {content}
            </p>
            <p className="text-sm text-white/75 leading-relaxed italic mt-3">
              C&apos;est ça mon analyse. Sur ce, voici le nouveau{" "}
              <Link href={`/ligue/${slug}/classement-general`} className="text-gold hover:underline not-italic font-medium">
                classement général
              </Link>.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted italic">
            La synthèse n&apos;a pas encore été générée pour cette journée.
          </p>
        )}
      </div>
    </div>
  );
}
