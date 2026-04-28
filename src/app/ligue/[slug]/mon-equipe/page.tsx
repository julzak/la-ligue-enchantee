import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getLeagueBySlug,
  getParticipantTeam,
  getRosterDayScores,
  getCurrentMatchday,
  getLockedClubIds,
} from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { MonEquipeContent } from "./MonEquipeContent";

const MIN_DAY = 1;

export default async function MonEquipePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    redirect("/login");
  }

  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  // Verify user belongs to this league
  const leagueUser = await prisma.leagueUser.findUnique({
    where: {
      leagueId_userId: { leagueId: league.dbId, userId: session.user.userId },
    },
  });

  if (!leagueUser) {
    return (
      <div className="text-muted p-8 text-center">
        <p className="text-lg font-serif text-white mb-2">Acces refuse</p>
        <p className="text-sm">Vous ne faites pas partie de cette ligue.</p>
      </div>
    );
  }

  const userId = session.user.userId;
  const currentDay = await getCurrentMatchday();

  // Resolve selected day from ?day= search param.
  // Bornes : [1, currentDay + 2]. Defaut : currentDay + 1 (prochaine journee).
  const { day: dayStr } = await searchParams;
  const maxDay = currentDay + 2;
  const dayParsed = dayStr ? parseInt(dayStr, 10) : NaN;
  const selectedDay = Number.isFinite(dayParsed) && dayParsed >= MIN_DAY && dayParsed <= maxDay
    ? dayParsed
    : currentDay + 1;

  const team = await getParticipantTeam(league.dbId, userId, selectedDay);
  const rosterPlayerIds = team.map((p) => p.playerId);
  // Resume "derniere journee" reste fige sur currentDay, pas lie au selecteur
  const lastDayScores = currentDay > 0
    ? await getRosterDayScores(rosterPlayerIds, currentDay)
    : [];
  const lockedClubIdsSet = await getLockedClubIds(selectedDay);

  return (
    <MonEquipeContent
      team={team}
      lastDayScores={lastDayScores}
      currentDay={currentDay}
      selectedDay={selectedDay}
      maxDay={maxDay}
      lockedClubIds={Array.from(lockedClubIdsSet)}
      leagueId={league.dbId}
      userName={session.user.name}
    />
  );
}
