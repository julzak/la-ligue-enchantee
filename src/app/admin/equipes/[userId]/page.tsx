import { notFound } from "next/navigation";
import {
  getLeagueBySlug,
  getUserById,
  getParticipantTeam,
  getCurrentMatchday,
  getParticipantDayScores,
} from "@/lib/db";
import { MonEquipeContent } from "@/app/ligue/[slug]/mon-equipe/MonEquipeContent";

export default async function AdminEquipeUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ league?: string; leagueId?: string }>;
}) {
  const { userId: userIdStr } = await params;
  const { league: slug, leagueId: leagueIdStr } = await searchParams;

  if (!slug || !leagueIdStr) notFound();

  const leagueDbId = Number(leagueIdStr);
  const userId = Number(userIdStr);

  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const user = await getUserById(userId);
  if (!user) notFound();

  const currentDay = await getCurrentMatchday();

  const [team, lastDayScores] = await Promise.all([
    getParticipantTeam(leagueDbId, userId),
    getParticipantDayScores(leagueDbId, userId, currentDay),
  ]);

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-lg border border-gold/20 px-4 py-3">
        <p className="text-sm text-gold">
          Mode admin : modification de l&apos;équipe de <strong>{user.cleanName}</strong>
        </p>
      </div>
      <MonEquipeContent
        team={team}
        lastDayScores={lastDayScores}
        currentDay={currentDay}
        leagueId={leagueDbId}
        userName={user.cleanName}
        adminOverrideUserId={userId}
      />
    </div>
  );
}
