import { notFound } from "next/navigation";
import { getLeagueBySlug, getClubsWithStats } from "@/lib/db";
import { ExplorateurContent } from "./ExplorateurContent";

export default async function ExplorateurPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const clubs = await getClubsWithStats(league.dbId);

  return <ExplorateurContent clubs={clubs} />;
}
