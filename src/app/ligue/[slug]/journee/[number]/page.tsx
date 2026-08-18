import { notFound } from "next/navigation";
import {
  getLeagueBySlug,
  getLeagueStandings,
  getParticipantDayScores,
  getCurrentMatchday,
} from "@/lib/db";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { PositionBadge } from "@/components/ui/PositionBadge";

export default async function JourneePage({ params }: { params: Promise<{ slug: string; number: string }> }) {
  const { slug, number: numStr } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const currentDay = await getCurrentMatchday();
  const matchday = numStr === "latest" ? currentDay : parseInt(numStr);
  if (!matchday || matchday < 1) notFound();

  const standings = await getLeagueStandings(league.dbId, matchday);

  // Get scores for each participant
  const participantScores = await Promise.all(
    standings.standings.map(async (s) => {
      const dayScores = await getParticipantDayScores(league.dbId, s.userId, matchday);
      return {
        userId: s.userId,
        userName: s.userName,
        trophies: s.trophies,
        initials: s.initials,
        rank: s.rank,
        dayTotal: s.lastMatchdayPoints,
        players: dayScores,
      };
    })
  );

  // Sort by day score descending
  const sorted = [...participantScores].sort((a, b) => b.dayTotal - a.dayTotal);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-serif text-xl text-white">Journée {matchday}</h2>
        <div className="flex gap-2">
          {matchday > 1 && (
            <a href={`/ligue/${slug}/journee/${matchday - 1}`} className="text-xs text-muted hover:text-gold px-2 py-1 rounded bg-surface-2">
              ← J{matchday - 1}
            </a>
          )}
          {matchday < currentDay && (
            <a href={`/ligue/${slug}/journee/${matchday + 1}`} className="text-xs text-muted hover:text-gold px-2 py-1 rounded bg-surface-2">
              J{matchday + 1} →
            </a>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((ps, i) => (
          <details
            key={ps.userId}
            className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden group"
            open={i === 0}
          >
            <summary className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer list-none">
              <div className="w-9 h-9 rounded-full bg-surface-2 border border-white/[0.07] flex items-center justify-center text-[10px] font-medium text-white/50 shrink-0">
                {ps.initials}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white block truncate">{ps.userName}</span>
                <span className="text-xs text-muted">{ps.rank}e au classement</span>
              </div>
              <span className="text-xl font-serif font-bold text-gold tabular-nums">
                {ps.dayTotal.toFixed(1)}
              </span>
              <svg className="w-5 h-5 text-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="border-t border-white/[0.07] px-2 py-1">
              {ps.players.map((p) => (
                <div
                  key={p.playerId}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-white/[0.02] rounded"
                >
                  <PlayerAvatar imageUrl={p.imageUrl} name={p.playerName} size={24} clubLogoUrl={p.clubLogo} />
                  <PositionBadge position={p.position} />
                  <span className="text-white/80 flex-1 truncate text-xs">{p.playerName}</span>
                  {/* Nom de club complet, comme partout ailleurs (demande Pierre 2026-08-18) */}
                  <span className="text-[10px] text-muted truncate max-w-[30%]">{p.clubName || p.clubShort}</span>
                  {p.goals > 0 && <span className="text-[10px] text-gold">{p.goals}g</span>}
                  {p.passes > 0 && <span className="text-[10px] text-vert">{p.passes}a</span>}
                  <span className={`text-sm font-bold tabular-nums w-8 text-right ${
                    p.total >= 8 ? "text-gold" : p.total >= 6 ? "text-vert" : p.total < 4 ? "text-rouge" : "text-white/60"
                  }`}>
                    {p.total.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
