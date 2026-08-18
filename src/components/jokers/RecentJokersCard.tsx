import Link from "next/link";
import { Zap } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import type { RecentJoker } from "@/lib/db";

// Rouge/vert éclaircis vs --rouge/--vert du thème : les valeurs du site
// passent sous le ratio de contraste 4.5:1 pour du texte de cette taille
// sur fond sombre.
const OUT_COLOR = "text-[#E05A4B]";
const IN_COLOR = "text-[#5DBE8A]";

function timeAgo(d: Date | null): string | null {
  if (!d) return null;
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: fr });
}

function jokerHref(j: RecentJoker): string {
  return j.topicId ? `/forum/topic/${j.topicId}` : `/forum/${j.leagueSlug}`;
}

function shortLeagueName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

// Carte "Derniers jokers" — variante accueil (toutes ligues, badge de ligue)
// ou sidebar de ligue (compacte, journée d'effet). Ne rien rendre si vide :
// le caller est censé tester, mais on se protège aussi ici.
export function RecentJokersCard({
  jokers,
  variant,
}: {
  jokers: RecentJoker[];
  variant: "home" | "league";
}) {
  if (jokers.length === 0) return null;

  const footHref =
    variant === "home" ? "/forum" : jokerHref(jokers[0]);
  const footLabel =
    variant === "home" ? "Tous les jokers sur le forum →" : "Fil des jokers →";

  return (
    <section className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
      <div className="bg-gold/10 px-4 py-3 border-b border-gold/20 flex items-center gap-2">
        <Zap className="w-4 h-4 text-gold" />
        <h2 className="font-serif text-sm text-gold font-medium">Derniers jokers</h2>
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {jokers.map((j) => {
          const when = timeAgo(j.createdAt);
          return (
            <li key={j.id}>
              {variant === "home" ? (
                <Link
                  href={jokerHref(j)}
                  className="flex items-baseline gap-x-1.5 gap-y-0.5 flex-wrap px-4 py-2.5 text-[13px] hover:bg-white/[0.04] transition-colors"
                >
                  <span className="text-white font-semibold">{j.userName}</span>
                  <span className="text-white/70">joue son joker :</span>
                  <span className={`${OUT_COLOR} font-medium`}>{j.playerOutName}</span>
                  {j.playerOutClub && (
                    <span className="text-[10px] text-muted uppercase">{j.playerOutClub}</span>
                  )}
                  <span className="text-gold-dim">→</span>
                  <span className={`${IN_COLOR} font-medium`}>{j.playerInName}</span>
                  {j.playerInClub && (
                    <span className="text-[10px] text-muted uppercase">{j.playerInClub}</span>
                  )}
                  <span className="ml-auto flex items-baseline gap-2">
                    <span className="text-[10px] text-gold bg-gold/[0.12] border border-gold/25 rounded px-1.5 whitespace-nowrap">
                      {shortLeagueName(j.leagueName)}
                    </span>
                    {when && (
                      <span className="text-[10px] text-muted italic whitespace-nowrap">{when}</span>
                    )}
                  </span>
                </Link>
              ) : (
                <Link
                  href={jokerHref(j)}
                  className="block px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors"
                >
                  <span className="text-white font-semibold">{j.userName}</span>
                  <span className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`${OUT_COLOR} font-medium truncate`}>{j.playerOutName}</span>
                    <span className="text-gold-dim shrink-0">→</span>
                    <span className={`${IN_COLOR} font-medium truncate`}>{j.playerInName}</span>
                  </span>
                  <span className="flex justify-between mt-0.5 text-[10px] text-muted italic">
                    <span>{when ?? ""}</span>
                    <span>effectif J{j.effectDay}</span>
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <Link
        href={footHref}
        className="block text-center py-2 text-xs text-gold hover:bg-gold/5 border-t border-white/[0.07] transition-colors"
      >
        {footLabel}
      </Link>
    </section>
  );
}
