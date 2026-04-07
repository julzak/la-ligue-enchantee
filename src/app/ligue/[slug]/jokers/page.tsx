import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getLeagueBySlug } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { JokersContent } from "./JokersContent";

export default async function JokersPage({
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

  return (
    <JokersContent
      leagueId={league.dbId}
      leagueSlug={slug}
    />
  );
}
