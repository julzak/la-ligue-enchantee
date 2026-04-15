import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }

  const { email } = await request.json() as { email: string };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    "UPDATE USER SET EMAIL = ? WHERE ID_USER = ?",
    email.trim(), userId
  );

  return NextResponse.json({ ok: true });
}
