export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin, invalidateAdminCache } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET: list all admins
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admins = await prisma.$queryRawUnsafe<{ user_id: number; name: string }[]>(
    `SELECT au.user_id, u.NAME as name
     FROM ADMIN_USER au
     JOIN USER u ON au.user_id = u.ID_USER
     ORDER BY u.NAME`
  );

  // Also get all users for the add dropdown
  const allUsers = await prisma.$queryRawUnsafe<{ id: number; name: string }[]>(
    `SELECT ID_USER as id, NAME as name FROM USER ORDER BY NAME`
  );

  // Clean HTML from names
  const clean = (n: string) => n.replace(/<[^>]*>/g, "").trim();

  return NextResponse.json({
    admins: admins.map((a) => ({ userId: a.user_id, name: clean(a.name) })),
    allUsers: allUsers.map((u) => ({ id: u.id, name: clean(u.name) })),
  });
}

// POST: add an admin
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { userId } = await request.json() as { userId: number };
  if (!userId) {
    return NextResponse.json({ error: "userId requis" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    "INSERT IGNORE INTO ADMIN_USER (user_id) VALUES (?)",
    userId
  );
  invalidateAdminCache();

  return NextResponse.json({ ok: true });
}

// DELETE: remove an admin
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { userId } = await request.json() as { userId: number };
  if (!userId) {
    return NextResponse.json({ error: "userId requis" }, { status: 400 });
  }

  // Prevent removing yourself
  const myId = (auth.session.user as { userId?: number }).userId;
  if (myId === userId) {
    return NextResponse.json({ error: "Impossible de se retirer soi-même" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    "DELETE FROM ADMIN_USER WHERE user_id = ?",
    userId
  );
  invalidateAdminCache();

  return NextResponse.json({ ok: true });
}
