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
  searchParams: Promise<{ league?: string; leagueId?: string; day?: string }>;
}) {
  const { userId: userIdStr } = await params;
  const { league: slug, leagueId: leagueIdStr, day: dayStr } = await searchParams;

  if (!slug || !leagueIdStr) notFound();

  const leagueDbId = Number(leagueIdStr);
  const userId = Number(userIdStr);

  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const user = await getUserById(userId);
  if (!user) notFound();

  const currentDay = await getCurrentMatchday();
  // Use the day param if provided, otherwise default to current matchday
  const targetDay = dayStr ? Number(dayStr) : currentDay;

  const [team, lastDayScores] = await Promise.all([
    getParticipantTeam(leagueDbId, userId, targetDay),
    getParticipantDayScores(leagueDbId, userId, targetDay),
  ]);

  // Mode admin : pas de lock cote UI (le backend bypass deja la deadline
  // pour les admins editant une autre equipe). On laisse aussi la borne
  // haute large pour que l'admin puisse remonter en avance si besoin.
  const maxDay = Math.max(currentDay + 2, targetDay);

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-lg border border-gold/20 px-4 py-3">
        <p className="text-sm text-gold">
          Mode admin : modification de l&apos;équipe de <strong>{user.cleanName}</strong> pour la <strong>Journée {targetDay}</strong>
        </p>
      </div>
      <MonEquipeContent
        team={team}
        lastDayScores={lastDayScores}
        currentDay={currentDay}
        selectedDay={targetDay}
        maxDay={maxDay}
        lockedClubIds={[]}
        leagueId={leagueDbId}
        userName={user.cleanName}
        adminOverrideUserId={userId}
      />
    </div>
  );
}
