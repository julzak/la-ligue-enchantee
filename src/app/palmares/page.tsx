import { Navbar } from "@/components/layout/Navbar";
import { Trophy, Star, Award } from "lucide-react";
import Link from "next/link";

interface Season {
  year: string;
  champion: string;
}

interface League {
  name: string;
  seasons: Season[];
}

const CHAMPIONNATS: League[] = [
  {
    name: "Ligue 1",
    seasons: [
      { year: "2024", champion: "Thib" },
      { year: "2023", champion: "Martial" },
      { year: "2022", champion: "Zenigata" },
      { year: "2021", champion: "Dimitri S" },
      { year: "2020", champion: "Nénéfin" },
      { year: "2019", champion: "ElioMM" },
      { year: "2018", champion: "Martial" },
      { year: "2017", champion: "Zenigata" },
      { year: "2016", champion: "Shima / Jay" },
      { year: "2015", champion: "Remy / Raf" },
      { year: "2014", champion: "Wino" },
    ],
  },
  {
    name: "Ligue 2",
    seasons: [
      { year: "2024", champion: "Arnoldo" },
      { year: "2023", champion: "Skippy" },
      { year: "2022", champion: "Bernard Lada" },
      { year: "2021", champion: "Lagolese" },
      { year: "2020", champion: "Skippy" },
      { year: "2019", champion: "Nums" },
      { year: "2018", champion: "Benhijk" },
      { year: "2017", champion: "Benhijk" },
      { year: "2016", champion: "Nums" },
      { year: "2015", champion: "Skaybi" },
      { year: "2014", champion: "Blek le Roc" },
      { year: "2013", champion: "Pili" },
    ],
  },
  {
    name: "National 1",
    seasons: [
      { year: "2024", champion: "Blek le Roc" },
      { year: "2023", champion: "Rom Aulas" },
      { year: "2022", champion: "Gelo 59" },
      { year: "2021", champion: "Vince77" },
      { year: "2020", champion: "Damoki Sakai" },
      { year: "2019", champion: "Troyan" },
      { year: "2018", champion: "Wicket" },
      { year: "2017", champion: "Troyan" },
      { year: "2016", champion: "Benhijk" },
      { year: "2015", champion: "Aelle" },
      { year: "2014", champion: "Nums" },
      { year: "2012", champion: "Douggy" },
    ],
  },
  {
    name: "National 2",
    seasons: [
      { year: "2019", champion: "Vince77" },
      { year: "2018", champion: "Kazu" },
      { year: "2017", champion: "Jun" },
      { year: "2016", champion: "Jo la Skeez" },
      { year: "2015", champion: "La Fripouille" },
      { year: "2014", champion: "Diamantinho" },
      { year: "2013", champion: "Thib" },
    ],
  },
  {
    name: "National 3",
    seasons: [
      { year: "2015", champion: "MadMax" },
      { year: "2014", champion: "Winogradsky" },
    ],
  },
];

const COUPE: Season[] = [
  { year: "2024", champion: "GeLo 59" },
  { year: "2023", champion: "Martial" },
  { year: "2022", champion: "Nums" },
  { year: "2021", champion: "GeLo 59" },
  { year: "2019", champion: "Vince77" },
  { year: "2018", champion: "Kazu" },
  { year: "2017", champion: "Kazu" },
  { year: "2016", champion: "Benhijk" },
  { year: "2015", champion: "Zenigata" },
  { year: "2014", champion: "Laplante" },
  { year: "2013", champion: "Thib" },
];

// Count total titles per player across all competitions
function getHallOfFame(): { name: string; titles: number; coupes: number }[] {
  const counts = new Map<string, { titles: number; coupes: number }>();
  for (const league of CHAMPIONNATS) {
    for (const s of league.seasons) {
      const prev = counts.get(s.champion) ?? { titles: 0, coupes: 0 };
      counts.set(s.champion, { ...prev, titles: prev.titles + 1 });
    }
  }
  for (const s of COUPE) {
    const prev = counts.get(s.champion) ?? { titles: 0, coupes: 0 };
    counts.set(s.champion, { ...prev, coupes: prev.coupes + 1 });
  }
  return Array.from(counts.entries())
    .map(([name, { titles, coupes }]) => ({ name, titles, coupes }))
    .sort((a, b) => (b.titles + b.coupes) - (a.titles + a.coupes))
    .filter((p) => p.titles + p.coupes >= 2);
}

function LeagueCard({ league }: { league: League }) {
  return (
    <div className="bg-surface rounded-xl border border-white/[0.07] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.05]">
        <h2 className="font-serif text-sm text-gold">{league.name}</h2>
      </div>
      <div className="divide-y divide-white/[0.03]">
        {league.seasons.map((s, i) => (
          <div
            key={s.year}
            className={`flex items-center justify-between px-5 py-2 ${i === 0 ? "bg-gold/[0.04]" : ""}`}
          >
            <span className="text-xs text-muted tabular-nums w-12">{s.year}</span>
            <span className={`text-sm ${i === 0 ? "text-gold font-medium" : "text-white/70"}`}>
              {s.champion}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PalmaresPage() {
  const hallOfFame = getHallOfFame();

  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl text-gold mb-2 flex items-center justify-center gap-3">
              <Trophy className="w-7 h-7" />
              Palmares
            </h1>
            <p className="text-sm text-muted">20 ans de fantasy football entre amis</p>
          </div>

          {/* Hall of Fame - players with 2+ trophies */}
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

          {/* Coupe */}
          <div className="mb-10">
            <h2 className="font-serif text-lg text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-rouge/70" />
              Coupe Enchantee
            </h2>
            <div className="bg-surface rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-white/[0.03]">
                {COUPE.map((s, i) => (
                  <div
                    key={s.year}
                    className={`flex flex-col items-center py-4 px-3 bg-surface ${i === 0 ? "bg-gold/[0.04]" : ""}`}
                  >
                    <span className="text-[10px] text-muted uppercase tracking-wider mb-1">{s.year}</span>
                    <span className={`text-sm font-medium ${i === 0 ? "text-gold" : "text-white/80"}`}>
                      {s.champion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Championnats grid */}
          <div className="mb-10">
            <h2 className="font-serif text-lg text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-gold/70" />
              Championnats
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {CHAMPIONNATS.map((league) => (
                <LeagueCard key={league.name} league={league} />
              ))}
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/" className="text-sm text-gold hover:underline">
              Retour a l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
