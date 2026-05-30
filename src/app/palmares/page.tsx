import { Navbar } from "@/components/layout/Navbar";
import { Trophy, Star, Award } from "lucide-react";
import Link from "next/link";
import { getAllPalmares, type PalmaresRow } from "@/lib/palmares";

export const dynamic = "force-dynamic";

// Ordre d'affichage des divisions (tier). Les labels inconnus passent après,
// triés alphabétiquement. "Coupe" est traitée à part (bloc dédié par saison).
const DIVISION_ORDER = ["Ligue 1", "Ligue 2", "National 1", "National 2", "National 3"];

function divisionRank(label: string): number {
  const i = DIVISION_ORDER.indexOf(label);
  return i === -1 ? DIVISION_ORDER.length + 1 : i;
}

function positionLabel(pos: string): string {
  if (pos === "1") return "1er";
  if (pos === "2") return "2e";
  if (pos === "3") return "3e";
  return pos; // "Vainqueur", "Finaliste"
}

// Tableau d'honneur : titres (champion de division, position "1") + coupes.
function buildHallOfFame(rows: PalmaresRow[]) {
  const counts = new Map<string, { titles: number; coupes: number }>();
  for (const r of rows) {
    const prev = counts.get(r.pseudo) ?? { titles: 0, coupes: 0 };
    if (r.divisionLabel === "Coupe" && r.position === "Vainqueur") {
      counts.set(r.pseudo, { ...prev, coupes: prev.coupes + 1 });
    } else if (r.divisionLabel !== "Coupe" && r.position === "1") {
      counts.set(r.pseudo, { ...prev, titles: prev.titles + 1 });
    }
  }
  return Array.from(counts.entries())
    .map(([name, c]) => ({ name, ...c }))
    .filter((p) => p.titles + p.coupes >= 2)
    .sort((a, b) => b.titles + b.coupes - (a.titles + a.coupes));
}

export default async function PalmaresPage() {
  const rows = await getAllPalmares();
  const hallOfFame = buildHallOfFame(rows);

  // Regroupement par année (plus récente en haut).
  const byYear = new Map<string, PalmaresRow[]>();
  for (const r of rows) {
    const arr = byYear.get(r.year) ?? [];
    arr.push(r);
    byYear.set(r.year, arr);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl text-gold mb-2 flex items-center justify-center gap-3">
              <Trophy className="w-7 h-7" />
              Palmarès
            </h1>
            <p className="text-sm text-muted">20 ans de fantasy football entre amis</p>
          </div>

          {/* Tableau d'honneur */}
          {hallOfFame.length > 0 && (
            <div className="mb-10">
              <h2 className="font-serif text-lg text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-gold/70" />
                Tableau d&apos;honneur
              </h2>
              <div className="bg-surface rounded-xl border border-white/[0.07] overflow-hidden">
                <div className="grid grid-cols-[1fr_5rem_5rem] px-5 py-2 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.05]">
                  <span>Joueur</span>
                  <span className="text-center">Titres</span>
                  <span className="text-center">Coupes</span>
                </div>
                {hallOfFame.map((p, i) => (
                  <div
                    key={p.name}
                    className={`grid grid-cols-[1fr_5rem_5rem] px-5 py-2.5 items-center border-b border-white/[0.03] last:border-b-0 ${i < 3 ? "bg-gold/[0.03]" : ""}`}
                  >
                    <span className={`text-sm ${i < 3 ? "text-gold font-medium" : "text-white/80"}`}>
                      {p.name}
                    </span>
                    <span className="text-sm text-center tabular-nums text-white/60">
                      {p.titles > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3 h-3 text-gold/50" />
                          {p.titles}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-center tabular-nums text-white/60">
                      {p.coupes > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-rouge/50" />
                          {p.coupes}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Par saison */}
          <div className="space-y-6">
            {years.map((year) => {
              const entries = byYear.get(year)!;
              const coupe = entries.filter((e) => e.divisionLabel === "Coupe");

              // Regroupe les championnats par division, podium trié.
              const divisions = new Map<string, PalmaresRow[]>();
              for (const e of entries.filter((x) => x.divisionLabel !== "Coupe")) {
                const arr = divisions.get(e.divisionLabel) ?? [];
                arr.push(e);
                divisions.set(e.divisionLabel, arr);
              }
              const divList = Array.from(divisions.entries()).sort(
                (a, b) => divisionRank(a[0]) - divisionRank(b[0])
              );

              return (
                <div key={year} className="bg-surface rounded-xl border border-white/[0.07] overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                    <h2 className="font-serif text-base text-gold tabular-nums">{year}</h2>
                    {coupe.find((c) => c.position === "Vainqueur") && (
                      <span className="text-xs text-muted inline-flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-rouge/70" />
                        Coupe : <span className="text-white/80 font-medium">{coupe.find((c) => c.position === "Vainqueur")!.pseudo}</span>
                        {coupe.find((c) => c.position === "Finaliste") && (
                          <span className="text-muted">
                            (finaliste {coupe.find((c) => c.position === "Finaliste")!.pseudo})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-px bg-white/[0.03] md:grid-cols-2 lg:grid-cols-3">
                    {divList.map(([division, podium]) => {
                      const sorted = [...podium].sort((a, b) =>
                        a.position.localeCompare(b.position, undefined, { numeric: true })
                      );
                      return (
                        <div key={division} className="bg-surface px-5 py-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
                            {division}
                          </div>
                          <div className="space-y-1">
                            {sorted.map((p) => (
                              <div key={p.position} className="flex items-center justify-between text-sm">
                                <span className={`${p.position === "1" ? "text-gold font-medium" : "text-white/70"}`}>
                                  {p.pseudo}
                                </span>
                                <span className="text-xs text-muted tabular-nums">{positionLabel(p.position)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <Link href="/" className="text-sm text-gold hover:underline">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
