export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST: toggle a reaction on a post
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { postId, emoji } = await request.json() as { postId: number; emoji: string };
  if (!postId || !emoji) return NextResponse.json({ error: "postId et emoji requis" }, { status: 400 });

  // Toggle: if exists, remove; if not, add
  const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM FORUM_REACTION WHERE post_id = ? AND user_id = ? AND emoji = ?",
    postId, userId, emoji
  );

  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      "DELETE FROM FORUM_REACTION WHERE post_id = ? AND user_id = ? AND emoji = ?",
      postId, userId, emoji
    );
    return NextResponse.json({ ok: true, action: "removed" });
  } else {
    await prisma.$executeRawUnsafe(
      "INSERT INTO FORUM_REACTION (post_id, user_id, emoji) VALUES (?, ?, ?)",
      postId, userId, emoji
    );
    return NextResponse.json({ ok: true, action: "added" });
  }
}
