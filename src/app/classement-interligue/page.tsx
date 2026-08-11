export const revalidate = 300; // ISR: refresh every 5 min

import Link from "next/link";
import { getInterleagueStandings, getCurrentMatchday } from "@/lib/db";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { Navbar } from "@/components/layout/Navbar";

export default async function ClassementInterliguePage() {
  const [standings, currentDay] = await Promise.all([
    getInterleagueStandings(),
    getCurrentMatchday(),
  ]);

  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-serif text-2xl text-gold">Classement interligue</h1>
              <p className="text-sm text-muted mt-1">{standings.length} participants - Journée {currentDay}</p>
            </div>
            <Link href="/" className="text-sm text-gold hover:underline">← Accueil</Link>
          </div>

          <div className="bg-surface rounded-lg border border-white/[0.07] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07] bg-surface-2">
                  <th className="px-3 py-2.5 text-left w-10">Pos.</th>
                  <th className="px-3 py-2.5 text-left">Ligueur</th>
                  <th className="px-3 py-2.5 text-left">Ligue</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5 text-right">Pts/jr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {standings.map((s) => (
                  <tr
                    key={s.userId}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      s.rank <= 3 ? "bg-gold/[0.03]" : s.rank === standings.length ? "bg-rouge/[0.03]" : s.rank % 2 === 0 ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <td className={`px-3 py-2.5 font-bold ${s.rank <= 3 ? "text-gold" : "text-muted"}`}>
                      {s.rank}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/ligue/${s.leagueSlug}/equipe/${s.userId}`}
                        className="text-white hover:text-gold transition-colors flex items-center"
                      >
                        {s.userName}
                        <TrophyBadges trophies={s.trophies} leagueSlug={s.leagueSlug} />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted text-xs">
                      {s.leagueName.replace("Ligue 1 (Baudens League)", "L1").replace("National 1", "Nat. 1").replace("Ligue 2", "L2").replace("Ligue 3", "L3")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white font-medium tabular-nums">
                      {s.totalPoints.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted tabular-nums">
                      {currentDay > 0 ? (s.totalPoints / currentDay).toFixed(2) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
