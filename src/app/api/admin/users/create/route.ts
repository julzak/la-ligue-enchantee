export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST {name, email?} : crée un compte participant.
// Mot de passe initial = "ligue" (même convention que la réinitialisation),
// à changer par le participant dans Mon compte.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { name, email } = (await request.json()) as { name?: string; email?: string };
  const pseudo = (name ?? "").trim().replace(/\s+/g, " ");
  const mail = (email ?? "").trim();

  if (pseudo.length < 2) {
    return NextResponse.json({ error: "Pseudo requis (2 caractères minimum)" }, { status: 400 });
  }
  if (/[<>]/.test(pseudo)) {
    // Les chevrons sont réservés aux trophées injectés par le système dans NAME.
    return NextResponse.json({ error: "Le pseudo ne peut pas contenir < ou >" }, { status: 400 });
  }
  if (pseudo.length > 50) {
    return NextResponse.json({ error: "Pseudo trop long (50 caractères max)" }, { status: 400 });
  }
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (mail.length > 50) {
    return NextResponse.json({ error: "Email trop long (50 caractères max)" }, { status: 400 });
  }

  // Le login se fait par pseudo (nom nettoyé des trophées) : il doit être
  // unique, sinon la connexion devient ambiguë.
  const candidates = await prisma.user.findMany({
    where: { name: { contains: pseudo.split(/[\s/]/)[0] } },
  });
  const clash = candidates.some((u) => {
    const clean = u.name.replace(/<[^>]*>/g, "").trim().replace(/\s+/g, " ").toLowerCase();
    return clean === pseudo.toLowerCase();
  });
  if (clash) {
    return NextResponse.json({ error: `Le pseudo « ${pseudo} » existe déjà` }, { status: 409 });
  }

  const hashed = await bcrypt.hash("ligue", 10);
  const user = await prisma.user.create({
    data: { name: pseudo, email: mail, password: hashed },
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: pseudo, email: mail },
    message: `Compte « ${pseudo} » créé. Mot de passe initial : ligue (à changer dans Mon compte).`,
  });
}
