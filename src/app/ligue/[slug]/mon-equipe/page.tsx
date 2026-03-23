import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getLeagueBySlug,
  getParticipantTeam,
  getRosterDayScores,
  getCurrentMatchday,
} from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { MonEquipeContent } from "./MonEquipeContent";

export default async function MonEquipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
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

  // Fetch team roster first, then scores for ALL roster players (not just lineup)
  const team = await getParticipantTeam(league.dbId, userId, currentDay);
  const rosterPlayerIds = team.map((p) => p.playerId);
  const lastDayScores = currentDay > 0
    ? await getRosterDayScores(rosterPlayerIds, currentDay)
    : [];

  return (
    <MonEquipeContent
      team={team}
      lastDayScores={lastDayScores}
      currentDay={currentDay}
      leagueId={league.dbId}
      userName={session.user.name}
    />
  );
}
