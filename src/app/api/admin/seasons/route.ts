export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import type { SeasonStatus } from "@prisma/client";

const VALID_STATUS: SeasonStatus[] = ["SETUP", "AUCTION", "ACTIVE", "WINTER", "CLOSED"];

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const seasons = await prisma.season.findMany({
    orderBy: { id: "desc" },
    include: { _count: { select: { clubs: true, players: true, leagues: true } } },
  });
  return NextResponse.json({ seasons });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { label } = await req.json();
  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Label requis" }, { status: 400 });
  }
  const trimmed = label.trim();

  const existing = await prisma.season.findFirst({ where: { label: trimmed } });
  if (existing) {
    return NextResponse.json({ error: "Une saison avec ce label existe déjà" }, { status: 409 });
  }

  const season = await prisma.season.create({
    data: { label: trimmed, status: "SETUP" },
  });
  return NextResponse.json({ season });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id, status, isCurrent } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const data: { status?: SeasonStatus; isCurrent?: boolean; startedAt?: Date } = {};
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    data.status = status;
    if (status === "ACTIVE") data.startedAt = new Date();
  }
  if (isCurrent !== undefined) data.isCurrent = Boolean(isCurrent);

  // Une seule saison courante à la fois : on transactionne le passage isCurrent.
  if (data.isCurrent === true) {
    const [, season] = await prisma.$transaction([
      prisma.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
      prisma.season.update({ where: { id: Number(id) }, data }),
    ]);
    return NextResponse.json({ season });
  }

  const season = await prisma.season.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ season });
}
