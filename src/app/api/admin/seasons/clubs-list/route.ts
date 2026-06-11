export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

// GET ?seasonId= : clubs déjà importés EN BASE pour une saison (à ne pas
// confondre avec /api/admin/seasons/clubs qui interroge l'API externe).
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const seasonId = Number(new URL(req.url).searchParams.get("seasonId"));
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

  const clubs = await prisma.club.findMany({
    where: { seasonId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ clubs });
}
