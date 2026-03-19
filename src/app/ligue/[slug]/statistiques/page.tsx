import { notFound } from "next/navigation";
import { getLeagueBySlug, getPlayerStats, getLeagueStats } from "@/lib/db";
import { StatsContent } from "./StatsContent";

export default async function StatistiquesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [playerStats, leagueStats] = await Promise.all([
    getPlayerStats(100),
    getLeagueStats(league.dbId),
  ]);

  return (
    <StatsContent
      playerStats={playerStats}
      leagueStats={leagueStats}
    />
  );
}
