export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import type { MovementType } from "@prisma/client";

// GET ?seasonId= : mouvements (montées/descentes) calculés à la clôture.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const seasonId = Number(searchParams.get("seasonId"));
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

  const movements = await prisma.seasonMovement.findMany({
    where: { seasonId },
    orderBy: [{ fromTier: "asc" }, { rankFinal: "asc" }],
  });
  return NextResponse.json({ movements });
}

// PATCH {id, toTier?, type?} : override admin d'un mouvement (repêchage).
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id, toTier, type } = (await req.json()) as {
    id?: number;
    toTier?: number;
    type?: MovementType;
  };
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const data: { toTier?: number; type?: MovementType; overridden: boolean } = { overridden: true };
  if (typeof toTier === "number") data.toTier = toTier;
  if (type) {
    if (!["PROMOTION", "RELEGATION", "STAY"].includes(type)) {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }
    data.type = type;
  }

  const movement = await prisma.seasonMovement.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ ok: true, movement });
}
