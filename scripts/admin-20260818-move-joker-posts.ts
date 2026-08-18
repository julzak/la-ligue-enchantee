// Geste admin du 2026-08-18 : recaser les posts de jokers 2026-2027 publiés
// dans le fil « Jokers 2025-2026 » de la Ligue 2 (topic 10) avant le fix du
// fil par saison (LIKE 'Jokers%' captait le fil de la saison passée).
// Crée le fil « Jokers 2026-2027 » en catégorie ligue-2 et y déplace les
// posts du jour, puis recalcule compteurs et derniers posts des deux fils.
// Idempotent : ne déplace que les posts listés s'ils sont encore en topic 10.
import { prisma } from "../src/lib/prisma";

const OLD_TOPIC = 10;
const POSTS_TO_MOVE = [131, 137, 138];
const NEW_TITLE = "Jokers 2026-2027";
const CATEGORY = "ligue-2";
const LEAGUE_ID = 40;

async function main() {
  const posts = await prisma.$queryRawUnsafe<{ id: number; author_id: number; created_at: Date }[]>(
    `SELECT id, author_id, created_at FROM FORUM_POST
     WHERE id IN (${POSTS_TO_MOVE.join(",")}) AND topic_id = ${OLD_TOPIC} ORDER BY id`
  );
  if (posts.length === 0) {
    console.log("Rien à déplacer (déjà fait ?)");
    return;
  }

  // Fil cible : existant ou créé (auteur = auteur du premier post déplacé)
  const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM FORUM_TOPIC WHERE category = ? AND title = ? LIMIT 1",
    CATEGORY, NEW_TITLE
  );
  let newTopicId: number;
  if (existing.length > 0) {
    newTopicId = Number(existing[0].id);
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO FORUM_TOPIC (league_id, category, author_id, title, post_count, last_post_at, last_post_by, created_at)
       VALUES (?, ?, ?, ?, 0, NOW(), ?, NOW())`,
      LEAGUE_ID, CATEGORY, Number(posts[0].author_id), NEW_TITLE, Number(posts[0].author_id)
    );
    const [row] = await prisma.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() as id");
    newTopicId = Number(row.id);
  }

  await prisma.$executeRawUnsafe(
    `UPDATE FORUM_POST SET topic_id = ? WHERE id IN (${POSTS_TO_MOVE.join(",")}) AND topic_id = ${OLD_TOPIC}`,
    newTopicId
  );

  // Recalcul des deux fils depuis les posts réels
  for (const topicId of [OLD_TOPIC, newTopicId]) {
    const [agg] = await prisma.$queryRawUnsafe<{ c: bigint; last_at: Date | null; last_by: number | null }[]>(
      `SELECT COUNT(*) c,
              (SELECT created_at FROM FORUM_POST WHERE topic_id = ? ORDER BY id DESC LIMIT 1) last_at,
              (SELECT author_id FROM FORUM_POST WHERE topic_id = ? ORDER BY id DESC LIMIT 1) last_by
       FROM FORUM_POST WHERE topic_id = ?`,
      topicId, topicId, topicId
    );
    await prisma.$executeRawUnsafe(
      "UPDATE FORUM_TOPIC SET post_count = ?, last_post_at = COALESCE(?, last_post_at), last_post_by = COALESCE(?, last_post_by) WHERE id = ?",
      Number(agg.c), agg.last_at, agg.last_by === null ? null : Number(agg.last_by), topicId
    );
    console.log(`topic ${topicId}: post_count=${Number(agg.c)}, last_by=${agg.last_by}`);
  }
  console.log(`${posts.length} post(s) déplacé(s) vers le topic ${newTopicId} (« ${NEW_TITLE} », ${CATEGORY})`);
}

main().finally(() => prisma.$disconnect());
