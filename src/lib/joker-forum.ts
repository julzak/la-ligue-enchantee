import { prisma } from "./prisma";
import { getCurrentSeasonKey } from "./season";

// Poste l'annonce d'un joker dans le fil « Jokers <saison courante> » de la
// catégorie, créé au besoin. Le fil est recherché par titre EXACT : l'ancienne
// recherche (LIKE 'Jokers%' + dernier id) faisait capter les jokers de la
// nouvelle saison par le fil de la saison passée quand celui de la saison
// courante n'existait pas encore (constaté le 2026-08-18 en L1/L2/N1, alors
// que la L3 avait déjà son fil 2026-2027). Logique partagée par la pose
// self-service (POST /api/jokers) et la pose admin (POST /api/admin/jokers).
export async function postJokerToForum(params: {
  leagueId: number;
  category: string;
  userId: number;
  content: string;
}): Promise<number> {
  const { leagueId, category, userId, content } = params;
  const seasonTitle = `Jokers ${await getCurrentSeasonKey()}`;

  const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM FORUM_TOPIC WHERE category = ? AND title = ? ORDER BY id DESC LIMIT 1",
    category, seasonTitle
  );

  let topicId: number;
  if (existing.length > 0) {
    topicId = Number(existing[0].id);
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO FORUM_TOPIC (league_id, category, author_id, title, post_count, last_post_at, last_post_by, created_at)
       VALUES (?, ?, ?, ?, 0, NOW(), ?, NOW())`,
      leagueId, category, userId, seasonTitle, userId
    );
    const [row] = await prisma.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() as id");
    topicId = Number(row.id);
  }

  await prisma.$executeRawUnsafe(
    "INSERT INTO FORUM_POST (topic_id, author_id, content, created_at) VALUES (?, ?, ?, NOW())",
    topicId, userId, content
  );
  await prisma.$executeRawUnsafe(
    "UPDATE FORUM_TOPIC SET post_count = post_count + 1, last_post_at = NOW(), last_post_by = ? WHERE id = ?",
    userId, topicId
  );

  return topicId;
}
