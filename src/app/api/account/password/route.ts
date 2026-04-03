import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json() as {
    currentPassword: string;
    newPassword: string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Les deux champs sont requis" }, { status: 400 });
  }

  if (newPassword.length < 4) {
    return NextResponse.json({ error: "Le nouveau mot de passe doit faire au moins 4 caractères" }, { status: 400 });
  }

  // Get current stored password
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Verify current password
  const storedPwd = user.password;
  let valid = false;

  if (storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$")) {
    valid = await bcrypt.compare(currentPassword, storedPwd);
  } else {
    // Legacy plain text
    valid = storedPwd.toLowerCase() === currentPassword.toLowerCase();
  }

  if (!valid) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
  }

  // Hash and save new password
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.$executeRawUnsafe(
    "UPDATE USER SET PASSWORD = ? WHERE ID_USER = ?",
    hashed, userId
  );

  return NextResponse.json({ ok: true, message: "Mot de passe modifié" });
}
