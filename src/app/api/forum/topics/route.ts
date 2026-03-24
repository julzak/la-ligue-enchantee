export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    ? await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
        `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${userIds.join(",")})`)
    : [];
  const userMap = new Map(users.map(u => [
    Number(u.ID_USER),
    (u.NAME ?? "").replace(/<[^>]*>/g, "").trim(),
  ]));

  // Get first post content for preview
  const topicIds = topics.map(t => Number(t.id));
  const firstPosts = topicIds.length > 0
    ? await prisma.$queryRawUnsafe<{ topic_id: number; content: string }[]>(
        `SELECT topic_id, content FROM FORUM_POST WHERE topic_id IN (${topicIds.join(",")})
         AND id IN (SELECT MIN(id) FROM FORUM_POST WHERE topic_id IN (${topicIds.join(",")}) GROUP BY topic_id)`)
    : [];
  const previewMap = new Map(firstPosts.map(p => [Number(p.topic_id), p.content.substring(0, 150)]));

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

  const { leagueId, title, content, category } = await request.json() as {
    leagueId: number;
    title: string;
    content: string;
    category?: string;
  };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Titre et contenu requis" }, { status: 400 });
  }

  // Create topic
  await prisma.$executeRawUnsafe(
    `INSERT INTO FORUM_TOPIC (league_id, category, author_id, title, post_count, last_post_at, last_post_by, created_at)
     VALUES (?, ?, ?, ?, 1, NOW(), ?, NOW())`,
    leagueId ?? 0, category ?? "general", userId, title.trim(), userId
  );

  const [row] = await prisma.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() as id");
  const topicId = Number(row.id);

  // Create first post
  await prisma.$executeRawUnsafe(
    `INSERT INTO FORUM_POST (topic_id, author_id, content, created_at) VALUES (?, ?, ?, NOW())`,
    topicId, userId, content.trim()
  );

  return NextResponse.json({ ok: true, topicId });
}
