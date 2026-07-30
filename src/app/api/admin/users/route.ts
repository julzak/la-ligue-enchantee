export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { requireAdmin, invalidateAdminCache } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
    admins: admins.map((a) => ({ userId: Number(a.user_id), name: clean(a.name) })),
    allUsers: allUsers.map((u) => ({ id: Number(u.id), name: clean(u.name) })),
  });
}

// POST: add an admin
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

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
  } catch (e) {
    return jsonError500("[users]", e, "Échec de l'ajout de l'administrateur");
  }
}

// PATCH: reset user password to "ligue"
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { userId } = await request.json() as { userId: number };
    if (!userId) {
      return NextResponse.json({ error: "userId requis" }, { status: 400 });
    }

    const hashed = await bcrypt.hash("ligue", 10);
    const result = await prisma.$executeRawUnsafe(
      "UPDATE USER SET PASSWORD = ? WHERE ID_USER = ?",
      hashed, userId
    );

    if (result === 0) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError500("[users]", e, "Échec de la réinitialisation du mot de passe");
  }
}

// DELETE: remove an admin
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

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
  } catch (e) {
    return jsonError500("[users]", e, "Échec du retrait de l'administrateur");
  }
}
