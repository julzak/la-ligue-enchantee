export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma, inParams } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { jsonError500 } from "@/lib/api-error";
import { getLeagues } from "@/lib/db";

// GET: list topics for a league (or all if leagueId=0)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  const category = searchParams.get("category") ?? "";

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];
  if (leagueId > 0) {
    where += " AND (t.league_id = ? OR t.league_id = 0)"; // 0 = interligue topics
    params.push(leagueId);
  }
  if (category) {
    where += " AND t.category = ?";
    params.push(category);
  }

  const topics = await prisma.$queryRawUnsafe<{
    id: number; league_id: number; category: string; author_id: number;
    title: string; pinned: number; locked: number; post_count: number;
    last_post_at: Date | null; last_post_by: number | null;
    created_at: Date;
  }[]>(
    `SELECT t.* FROM FORUM_TOPIC t ${where} ORDER BY t.pinned DESC, COALESCE(t.last_post_at, t.created_at) DESC LIMIT 50`,
    ...params
  );

  // Get user names for authors and last posters
  const userIds = Array.from(new Set(
    topics.flatMap(t => [t.author_id, t.last_post_by].filter(Boolean))
  )) as number[];

  const users = userIds.length > 0
    ? await (async () => { const [ph, vs] = inParams(userIds); return prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
        `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${ph})`, ...vs); })()
    : [];
  const userMap = new Map(users.map(u => [
    Number(u.ID_USER),
    (u.NAME ?? "").replace(/<[^>]*>/g, "").trim(),
  ]));

  // Get latest post content for preview (matches topic page which shows most recent first)
  const topicIds = topics.map(t => Number(t.id));
  const latestPosts = topicIds.length > 0
    ? await (async () => { const [ph, vs] = inParams(topicIds); return prisma.$queryRawUnsafe<{ topic_id: number; content: string }[]>(
        `SELECT topic_id, content FROM FORUM_POST WHERE topic_id IN (${ph})
         AND id IN (SELECT MAX(id) FROM FORUM_POST WHERE topic_id IN (${ph}) GROUP BY topic_id)`, ...vs, ...vs); })()
    : [];
  const previewMap = new Map(latestPosts.map(p => [Number(p.topic_id), p.content.substring(0, 150)]));

  return NextResponse.json({
    topics: topics.map(t => ({
      id: Number(t.id),
      leagueId: Number(t.league_id),
      category: t.category,
      authorId: Number(t.author_id),
      authorName: userMap.get(Number(t.author_id)) ?? "?",
      title: t.title,
      pinned: t.pinned > 0,
      locked: t.locked > 0,
      postCount: Number(t.post_count),
      lastPostAt: t.last_post_at,
      lastPostBy: t.last_post_by ? (userMap.get(Number(t.last_post_by)) ?? "?") : null,
      createdAt: t.created_at,
      preview: previewMap.get(Number(t.id)) ?? "",
    })),
  });
}

// POST: create a new topic
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { title, content, category } = await request.json() as {
    title: string;
    content: string;
    category?: string;
  };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Titre et contenu requis" }, { status: 400 });
  }

  // La ligue est résolue côté serveur depuis la catégorie (slug de la ligue
  // de la saison courante). Avant (bug Violet 2026-08-31), le client envoyait
  // des IDs 2025-2026 codés en dur : les nouveaux sujets étaient rattachés
  // aux ligues de l'ancienne saison. Catégorie sans ligue (general, coupe) = 0.
  const leagues = await getLeagues();
  const targetLeagueId = leagues.find((l) => l.slug === category)?.dbId ?? 0;
  // Appartenance : poster dans une ligue précise exige d'en être membre.
  // leagueId=0 = interligue, ouvert à tout utilisateur authentifié.
  if (targetLeagueId > 0) {
    const membership = await prisma.leagueUser.findUnique({
      where: { leagueId_userId: { leagueId: targetLeagueId, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette ligue" }, { status: 403 });
    }
  }

  try {
    // Create topic
    await prisma.$executeRawUnsafe(
      `INSERT INTO FORUM_TOPIC (league_id, category, author_id, title, post_count, last_post_at, last_post_by, created_at)
       VALUES (?, ?, ?, ?, 1, NOW(), ?, NOW())`,
      targetLeagueId, category ?? "general", userId, title.trim(), userId
    );

    const [row] = await prisma.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() as id");
    const topicId = Number(row.id);

    // Create first post
    await prisma.$executeRawUnsafe(
      `INSERT INTO FORUM_POST (topic_id, author_id, content, created_at) VALUES (?, ?, ?, NOW())`,
      topicId, userId, content.trim()
    );

    return NextResponse.json({ ok: true, topicId });
  } catch (e) {
    return jsonError500("Forum topic create error:", e, "Erreur lors de la création du sujet");
  }
}

// DELETE: delete a topic and all its posts (admin only)
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { topicId } = await request.json() as { topicId: number };
  if (!topicId) return NextResponse.json({ error: "topicId requis" }, { status: 400 });

  // Get all post IDs for this topic (to clean reactions)
  const posts = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM FORUM_POST WHERE topic_id = ?", topicId
  );
  const postIds = posts.map(p => Number(p.id));

  // Delete reactions
  if (postIds.length > 0) {
    const [ph, vs] = inParams(postIds);
    await prisma.$executeRawUnsafe(
      `DELETE FROM FORUM_REACTION WHERE post_id IN (${ph})`, ...vs
    );
  }

  // Delete posts
  await prisma.$executeRawUnsafe("DELETE FROM FORUM_POST WHERE topic_id = ?", topicId);

  // Delete topic
  await prisma.$executeRawUnsafe("DELETE FROM FORUM_TOPIC WHERE id = ?", topicId);

  return NextResponse.json({ ok: true, message: "Sujet et posts supprimés" });
}
