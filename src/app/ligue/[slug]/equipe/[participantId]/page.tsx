import { notFound } from "next/navigation";
import {
  getLeagueBySlug,
  getUserById,
  getParticipantTeam,
  getLeagueStandings,
  getInterleagueStandings,
  getCurrentMatchday,
  getParticipantDayScores,
  getParticipantCumulativeStats,
} from "@/lib/db";
import { EquipeContent } from "./EquipeContent";

export default async function EquipeParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; participantId: string }>;
  searchParams: Promise<{ j?: string }>;
}) {
  const { slug, participantId: participantIdStr } = await params;
  const { j } = await searchParams;

  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const participantId = Number(participantIdStr);
  const participant = await getUserById(participantId);
  if (!participant) notFound();

  const currentDay = await getCurrentMatchday();

  // Default to current matchday when no ?j= is provided (show day results, not cumul)
  const showCumul = j === "cumul";
  const selectedJournee = showCumul ? currentDay : (j ? Number(j) : currentDay);

  const [team, standingsData, interleagueData] = await Promise.all([
    getParticipantTeam(league.dbId, participantId, selectedJournee),
    getLeagueStandings(league.dbId),
    getInterleagueStandings(),
  ]);

  // Fetch day scores or cumulative stats
  const dayScores = !showCumul
    ? await getParticipantDayScores(league.dbId, participantId, selectedJournee)
    : null;

  const cumulativeStats = showCumul
    ? await getParticipantCumulativeStats(league.dbId, participantId, currentDay)
    : null;

  // Find this participant's rank in league standings
  const leagueStanding = standingsData.standings.find((s) => s.userId === participantId);
  const leagueRank = leagueStanding?.rank ?? null;

  // Find interleague rank
  const interRank = interleagueData.find((s) => s.userId === participantId);
  const interleagueRank = interRank?.rank ?? null;

  return (
    <EquipeContent
      slug={slug}
      participantId={participantId}
      participantName={participant.cleanName}
      participantTrophies={participant.trophies}
      team={team}
      dayScores={dayScores}
      cumulativeStats={cumulativeStats}
      selectedJournee={showCumul ? null : selectedJournee}
      currentMatchday={currentDay}
      leagueRank={leagueRank}
      interleagueRank={interleagueRank}
    />
  );
}
