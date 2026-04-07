export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

const VALID_POSITIONS = ["Gardien", "Défense", "Milieu", "Attaque"];
const LEGION_ETRANGERE_ID = 21;

// GET: search players by name
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";

  if (search.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const players = await prisma.$queryRawUnsafe<
    { ID_PLAYER: number; FNAME: string; LNAME: string; POSITION: string; ID_CLUB: number; clubName: string }[]
  >(
    `SELECT p.ID_PLAYER, p.FNAME, p.LNAME, p.POSITION, p.ID_CLUB, COALESCE(c.NAME, '') as clubName
     FROM PLAYER p LEFT JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE p.LNAME LIKE ? OR p.FNAME LIKE ?
     ORDER BY p.LNAME ASC LIMIT 50`,
    `%${search}%`,
    `%${search}%`
  );

  return NextResponse.json({
    players: players.map((p) => ({
      id: Number(p.ID_PLAYER),
      fname: p.FNAME,
      lname: p.LNAME,
      position: p.POSITION,
      clubId: Number(p.ID_CLUB),
      clubName: p.clubName,
    })),
  });
}

// POST: create a new player (Legion etrangere)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { fname, lname, position } = (await request.json()) as {
    fname: string;
    lname: string;
    position: string;
  };

  if (!fname?.trim() || !lname?.trim()) {
    return NextResponse.json({ error: "Prenom et nom requis" }, { status: 400 });
  }
  if (!VALID_POSITIONS.includes(position)) {
    return NextResponse.json({ error: "Position invalide" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    "INSERT INTO PLAYER (ID_CLUB, FNAME, LNAME, POSITION) VALUES (?, ?, ?, ?)",
    LEGION_ETRANGERE_ID,
    fname.trim(),
    lname.trim(),
    position
  );

  const [row] = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT LAST_INSERT_ID() as id"
  );

  return NextResponse.json({
    ok: true,
    player: { id: Number(row.id), fname: fname.trim(), lname: lname.trim(), position, clubId: LEGION_ETRANGERE_ID },
  });
}

// PUT: edit player fname/lname/position
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id, fname, lname, position } = (await request.json()) as {
    id: number;
    fname: string;
    lname: string;
    position: string;
  };

  if (!id) {
    return NextResponse.json({ error: "ID joueur requis" }, { status: 400 });
  }
  if (!fname?.trim() || !lname?.trim()) {
    return NextResponse.json({ error: "Prenom et nom requis" }, { status: 400 });
  }
  if (!VALID_POSITIONS.includes(position)) {
    return NextResponse.json({ error: "Position invalide" }, { status: 400 });
  }

  const result = await prisma.$executeRawUnsafe(
    "UPDATE PLAYER SET FNAME = ?, LNAME = ?, POSITION = ? WHERE ID_PLAYER = ?",
    fname.trim(),
    lname.trim(),
    position,
    id
  );

  if (result === 0) {
    return NextResponse.json({ error: "Joueur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, player: { id, fname: fname.trim(), lname: lname.trim(), position } });
}
