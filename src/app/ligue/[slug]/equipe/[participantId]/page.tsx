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

  const [team, standingsData, interleagueData, currentDay] = await Promise.all([
    getParticipantTeam(league.dbId, participantId),
    getLeagueStandings(league.dbId),
    getInterleagueStandings(),
    getCurrentMatchday(),
  ]);

  const selectedJournee = j ? Number(j) : null;

  // Fetch day scores or cumulative stats
  const dayScores = selectedJournee
    ? await getParticipantDayScores(league.dbId, participantId, selectedJournee)
    : null;

  const cumulativeStats = !selectedJournee
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
      selectedJournee={selectedJournee}
      currentMatchday={currentDay}
      leagueRank={leagueRank}
      interleagueRank={interleagueRank}
    />
  );
}
