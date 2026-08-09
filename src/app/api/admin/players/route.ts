export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getCurrentSeason } from "@/lib/season";

const VALID_POSITIONS = ["Gardien", "Défense", "Milieu", "Attaque"];
// Club d'accueil des joueurs hors championnat (pari mercato historique :
// miser sur un joueur pas encore arrivé en Ligue 1). Résolu par NOM et par
// saison : l'ancien id codé en dur (21) ne correspondait à aucun club.
const LEGION_ETRANGERE_NAME = "Légion étrangère";

// GET: search players by name
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);

  if (searchParams.get("list") === "clubs") {
    const clubs = await prisma.$queryRawUnsafe<{ ID_CLUB: number; NAME: string }[]>(
      "SELECT ID_CLUB, NAME FROM CLUB ORDER BY NAME"
    );
    return NextResponse.json({
      clubs: clubs.map((c) => ({ id: Number(c.ID_CLUB), name: c.NAME })),
    });
  }

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

// POST: create a new player (any club, defaults to Légion étrangère)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { fname, lname, position, clubId } = (await request.json()) as {
      fname: string;
      lname: string;
      position: string;
      clubId?: number;
    };

    if (!fname?.trim() || !lname?.trim()) {
      return NextResponse.json({ error: "Prenom et nom requis" }, { status: 400 });
    }
    if (!VALID_POSITIONS.includes(position)) {
      return NextResponse.json({ error: "Position invalide" }, { status: 400 });
    }

    const currentSeason = await getCurrentSeason();

    let targetClubId = clubId ? Number(clubId) : 0;
    if (!targetClubId) {
      // Sans club explicite : Légion étrangère de la saison courante,
      // créée au besoin (idempotent par nom + saison).
      const legion = await prisma.club.findFirst({
        where: { name: LEGION_ETRANGERE_NAME, seasonId: currentSeason?.id ?? null },
      });
      targetClubId = legion
        ? legion.id
        : (
            await prisma.club.create({
              data: { name: LEGION_ETRANGERE_NAME, idClubEq: "", seasonId: currentSeason?.id ?? null },
            })
          ).id;
    }

    const targetClub = await prisma.club.findUnique({ where: { id: targetClubId } });
    if (!targetClub) {
      return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
    }

    // ID_SEASON obligatoire pour que le joueur soit visible du pool d'enchères
    // (le scoping saison exclut les joueurs sans saison). Un joueur créé sans
    // saison était introuvable à la mise : chaîne du pari mercato cassée.
    const playerSeasonId = targetClub.seasonId ?? currentSeason?.id ?? null;

    await prisma.$executeRawUnsafe(
      "INSERT INTO PLAYER (ID_CLUB, FNAME, LNAME, POSITION, ID_SEASON) VALUES (?, ?, ?, ?, ?)",
      targetClubId,
      fname.trim(),
      lname.trim(),
      position,
      playerSeasonId
    );

    const [row] = await prisma.$queryRawUnsafe<{ id: number }[]>(
      "SELECT LAST_INSERT_ID() as id"
    );

    return NextResponse.json({
      ok: true,
      player: { id: Number(row.id), fname: fname.trim(), lname: lname.trim(), position, clubId: targetClubId },
    });
  } catch (e) {
    return jsonError500("[players]", e, "Échec de la création du joueur");
  }
}

// PUT: edit player fname/lname/position, et clubId optionnel (transferts du
// mercato réel : la source effectifs est en retard sur les transferts, le
// déplacement manuel préserve l'ID joueur donc les mises qui le référencent).
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { id, fname, lname, position, clubId } = (await request.json()) as {
      id: number;
      fname: string;
      lname: string;
      position: string;
      clubId?: number;
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

    if (clubId !== undefined) {
      // Le club cible doit exister et appartenir à la même saison que le
      // joueur (pas de déplacement inter-saisons, qui casserait le scoping).
      const player = await prisma.player.findUnique({ where: { id: Number(id) } });
      if (!player) return NextResponse.json({ error: "Joueur introuvable" }, { status: 404 });
      const club = await prisma.club.findUnique({ where: { id: Number(clubId) } });
      if (!club) return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
      if ((club.seasonId ?? null) !== (player.seasonId ?? null)) {
        return NextResponse.json(
          { error: "Le club cible n'appartient pas à la même saison que le joueur" },
          { status: 400 }
        );
      }
    }

    const result = clubId !== undefined
      ? await prisma.$executeRawUnsafe(
          "UPDATE PLAYER SET FNAME = ?, LNAME = ?, POSITION = ?, ID_CLUB = ? WHERE ID_PLAYER = ?",
          fname.trim(), lname.trim(), position, Number(clubId), id
        )
      : await prisma.$executeRawUnsafe(
          "UPDATE PLAYER SET FNAME = ?, LNAME = ?, POSITION = ? WHERE ID_PLAYER = ?",
          fname.trim(), lname.trim(), position, id
        );

    if (result === 0) {
      return NextResponse.json({ error: "Joueur introuvable" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, player: { id, fname: fname.trim(), lname: lname.trim(), position } });
  } catch (e) {
    return jsonError500("[players]", e, "Échec de la modification du joueur");
  }
}
