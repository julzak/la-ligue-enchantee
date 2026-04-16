export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma, inParams } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";

// GET: list posts for a topic
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topicId = Number(searchParams.get("topicId") ?? 0);
  if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

  // Get topic info
  const [topic] = await prisma.$queryRawUnsafe<{
    id: number; league_id: number; category: string; author_id: number;
    title: string; pinned: number; locked: number; post_count: number; created_at: Date;
  }[]>("SELECT * FROM FORUM_TOPIC WHERE id = ?", topicId);

  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  // Get all posts
  const posts = await prisma.$queryRawUnsafe<{
    id: number; topic_id: number; author_id: number; content: string;
    created_at: Date; updated_at: Date | null;
  }[]>(
    "SELECT * FROM FORUM_POST WHERE topic_id = ? ORDER BY created_at DESC",
    topicId
  );

  // Get user names
  const userIds = Array.from(new Set([
    Number(topic.author_id),
    ...posts.map(p => Number(p.author_id)),
  ]));
  const [uPh, uVals] = inParams(userIds);
  const users = await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
    `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${uPh})`, ...uVals
  );
  const userMap = new Map(users.map(u => [
    Number(u.ID_USER),
    (u.NAME ?? "").replace(/<[^>]*>/g, "").trim(),
  ]));

  // Get reactions for all posts
  const postIds = posts.map(p => Number(p.id));
  const reactions = postIds.length > 0
    ? (() => { const [ph, vs] = inParams(postIds); return prisma.$queryRawUnsafe<{ post_id: number; emoji: string; user_id: number }[]>(
        `SELECT post_id, emoji, user_id FROM FORUM_REACTION WHERE post_id IN (${ph})`, ...vs); })()
    : [];

  // Group reactions by post: { postId: { emoji: { count, userIds } } }
  const reactionsByPost = new Map<number, Map<string, { count: number; userIds: number[] }>>();
  for (const r of reactions) {
    const pid = Number(r.post_id);
    if (!reactionsByPost.has(pid)) reactionsByPost.set(pid, new Map());
    const postReactions = reactionsByPost.get(pid)!;
    if (!postReactions.has(r.emoji)) postReactions.set(r.emoji, { count: 0, userIds: [] });
    const entry = postReactions.get(r.emoji)!;
    entry.count++;
    entry.userIds.push(Number(r.user_id));
  }

  return NextResponse.json({
    topic: {
      id: Number(topic.id),
      leagueId: Number(topic.league_id),
      category: topic.category,
      authorId: Number(topic.author_id),
      authorName: userMap.get(Number(topic.author_id)) ?? "?",
      title: topic.title,
      pinned: topic.pinned > 0,
      locked: topic.locked > 0,
      postCount: Number(topic.post_count),
      createdAt: topic.created_at,
    },
    posts: posts.map(p => {
      const pr = reactionsByPost.get(Number(p.id));
      const reacts: { emoji: string; count: number; userIds: number[] }[] = [];
      if (pr) pr.forEach((v, k) => reacts.push({ emoji: k, count: v.count, userIds: v.userIds }));
      return {
        id: Number(p.id),
        authorId: Number(p.author_id),
        authorName: userMap.get(Number(p.author_id)) ?? "?",
        content: p.content,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        reactions: reacts,
      };
    }),
  });
}

// POST: reply to a topic
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { topicId, content } = await request.json() as { topicId: number; content: string };

  if (!topicId || !content?.trim()) {
    return NextResponse.json({ error: "topicId et content requis" }, { status: 400 });
  }

  // Check topic exists and not locked
  const [topic] = await prisma.$queryRawUnsafe<{ id: number; locked: number }[]>(
    "SELECT id, locked FROM FORUM_TOPIC WHERE id = ?", topicId
  );
  if (!topic) return NextResponse.json({ error: "Topic introuvable" }, { status: 404 });
  if (topic.locked) return NextResponse.json({ error: "Sujet verrouille" }, { status: 403 });

  // Insert post
  await prisma.$executeRawUnsafe(
    "INSERT INTO FORUM_POST (topic_id, author_id, content, created_at) VALUES (?, ?, ?, NOW())",
    topicId, userId, content.trim()
  );

  // Update topic stats
  await prisma.$executeRawUnsafe(
    "UPDATE FORUM_TOPIC SET post_count = post_count + 1, last_post_at = NOW(), last_post_by = ? WHERE id = ?",
    userId, topicId
  );

  return NextResponse.json({ ok: true });
}

// DELETE: delete a post (admin only)
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { postId } = await request.json() as { postId: number };
  if (!postId) return NextResponse.json({ error: "postId requis" }, { status: 400 });

  // Get post info to update topic stats
  const [post] = await prisma.$queryRawUnsafe<{ id: number; topic_id: number }[]>(
    "SELECT id, topic_id FROM FORUM_POST WHERE id = ?", postId
  );
  if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });

  // Delete reactions for this post
  await prisma.$executeRawUnsafe("DELETE FROM FORUM_REACTION WHERE post_id = ?", postId);

  // Delete the post
  await prisma.$executeRawUnsafe("DELETE FROM FORUM_POST WHERE id = ?", postId);

  // Update topic post count
  await prisma.$executeRawUnsafe(
    "UPDATE FORUM_TOPIC SET post_count = GREATEST(post_count - 1, 0) WHERE id = ?",
    Number(post.topic_id)
  );

  return NextResponse.json({ ok: true, message: "Post supprimé" });
}
