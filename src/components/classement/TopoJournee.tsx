"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

interface TopoJourneeProps {
  matchday: number;
  leagueName: string;
  slug: string;
}

const topos: Record<string, string> = {
  "ligue-1": `Thib reprend les commandes grâce au doublé de Balogun (10 pts), pendant que David A coule tranquillement vers la zone de relégation (-2 places, merci Mandanda et ses 3 buts encaissés). Mention spéciale à Zenigata qui aligne un 19 pts tout sec - on se demande si son équipe a joué ce week-end. Le duel Blek/Duch pour la 2e place se joue à 1 point : préparez le pop-corn. 🍿`,
  "ligue-2": `Francis Llacer continue son cavalier seul avec 62 pts grâce au festival de Greenwood (but + passe). Gonz remonte dans le top 10 grâce au penalty arrêté de Samba - parfois il suffit d'un gardien qui fait son travail. En bas de tableau, Momo enchaîne une 4e journée sous les 35 pts. À ce rythme, ses joueurs vont demander une mutation. Troy et Raph G. se battent pour le titre honorifique de "dernier à ne pas être dernier".`,
  "national-1": `Troyan survole les débats avec 60 pts et creuse l'écart sur FC Terrich. Le secret ? Avoir misé sur Thauvin au mercato quand tout le monde rigolait. Benhijk perd 1 place après le carton rouge de Fofana - la note zéro fait toujours aussi mal. Dario et Chris B. ferment la marche avec un score combiné inférieur au total de Troyan seul. On appelle ça de la domination. 👑`,
};

export function TopoJournee({ matchday, leagueName, slug }: TopoJourneeProps) {
  const topoSlug = leagueName.toLowerCase().includes("baudens") ? "ligue-1"
    : leagueName.toLowerCase().includes("national") ? "national-1"
    : "ligue-2";
  const content = topos[topoSlug] ?? topos["ligue-1"];

  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <Sparkles className="w-4 h-4 text-gold" />
        <h3 className="font-serif text-sm text-gold">Journée {matchday} : la synthèse de Lia 🤖</h3>
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
