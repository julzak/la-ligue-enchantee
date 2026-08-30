// Seule page de données fraîches du repo sans config de segment : sans
// revalidate, Next 14 peut figer le rendu dans le Full Route Cache (badge
// Libre/propriétaire périmé après un joker).
export const revalidate = 60;

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
