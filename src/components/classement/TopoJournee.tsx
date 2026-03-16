"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";

interface TopoJourneeProps {
  matchday: number;
  leagueName: string;
  slug: string;
}

const fallbackTopos: Record<string, string> = {
  "ligue-1": `Thib reprend les commandes grâce au doublé de Balogun (10 pts), pendant que David A coule tranquillement vers la zone de relégation (-2 places, merci Mandanda et ses 3 buts encaissés). Mention spéciale à Zenigata qui aligne un 19 pts tout sec - on se demande si son équipe a joué ce week-end. Le duel Blek/Duch pour la 2e place se joue à 1 point : préparez le pop-corn. 🍿`,
  "ligue-2": `Francis Llacer continue son cavalier seul grâce au festival de Greenwood (but + passe). En bas de tableau, la lutte pour ne pas être dernier fait rage.`,
  "national-1": `Troyan survole les débats et creuse l'écart. Le secret ? Avoir misé sur Thauvin au mercato quand tout le monde rigolait. 👑`,
};

export function TopoJournee({ matchday, leagueName, slug }: TopoJourneeProps) {
  const topoSlug = leagueName.toLowerCase().includes("baudens") ? "ligue-1"
    : leagueName.toLowerCase().includes("national") ? "national-1"
    : "ligue-2";

  const [content, setContent] = useState(fallbackTopos[topoSlug] ?? "");
  const [isGenerated, setIsGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  async function generateTopo() {
    setLoading(true);
    try {
      const res = await fetch("/api/topo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data.topo);
        setIsGenerated(true);
      }
    } catch {
      // Keep fallback
    }
    setLoading(false);
  }

  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <Sparkles className="w-4 h-4 text-gold" />
        <h3 className="font-serif text-sm text-gold">Journée {matchday} : la synthèse de Lia 🤖</h3>
        {!isGenerated && (
          <button
            onClick={generateTopo}
            disabled={loading}
            className="ml-auto text-[10px] uppercase tracking-wider text-gold/60 hover:text-gold bg-surface-2 hover:bg-gold/10 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Générer avec l'IA"}
          </button>
        )}
      </div>
      <div className="px-5 pb-4">
        <p className="text-sm text-white/75 leading-relaxed italic">
          {content}
        </p>
        <p className="text-sm text-white/75 leading-relaxed italic mt-3">
          C&apos;est ça mon analyse. Sur ce, voici le nouveau{" "}
          <Link href={`/ligue/${slug}/classement-general`} className="text-gold hover:underline not-italic font-medium">
            classement général
          </Link>.
        </p>
      </div>
    </div>
  );
}
