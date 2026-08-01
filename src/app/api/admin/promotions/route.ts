export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

interface LeagueRow { id: number; name: string }
interface ParticipantRow { leagueId: number; userId: number; userName: string }

// GET: list all leagues with their participants
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const leagues = await prisma.$queryRawUnsafe<LeagueRow[]>(
    "SELECT ID_LEAGUE as id, NAME as name FROM LEAGUE ORDER BY NAME"
  );

  const participants = await prisma.$queryRawUnsafe<ParticipantRow[]>(
    `SELECT lu.ID_LEAGUE as leagueId, lu.ID_USER as userId, u.NAME as userName
     FROM LEAGUE_USER lu
     JOIN USER u ON lu.ID_USER = u.ID_USER
     ORDER BY u.NAME`
  );

  const clean = (n: string) => n.replace(/<[^>]*>/g, "").trim();

  const result = leagues.map((l) => ({
    id: Number(l.id),
    name: l.name,
    participants: participants
      .filter((p) => Number(p.leagueId) === Number(l.id))
      .map((p) => ({ userId: Number(p.userId), name: clean(p.userName) }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  }));

  return NextResponse.json({ leagues: result });
}

// POST: move a participant to a different league
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { userId, fromLeagueId, toLeagueId } = await request.json() as {
      userId: number;
      fromLeagueId: number;
      toLeagueId: number;
    };

    if (!userId || !fromLeagueId || !toLeagueId) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    if (fromLeagueId === toLeagueId) {
      return NextResponse.json({ error: "Même ligue" }, { status: 400 });
    }

    // Remove from old league
    await prisma.$executeRawUnsafe(
      "DELETE FROM LEAGUE_USER WHERE ID_LEAGUE = ? AND ID_USER = ?",
      fromLeagueId, userId
    );

    // Add to new league
    await prisma.$executeRawUnsafe(
      "INSERT IGNORE INTO LEAGUE_USER (ID_LEAGUE, ID_USER) VALUES (?, ?)",
      toLeagueId, userId
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError500("[promotions]", e, "Échec du changement de ligue");
  }
}

// PATCH: rename a participant (preserves trophy HTML tags)
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { userId, newName } = await request.json() as { userId: number; newName: string };
    if (!userId || !newName?.trim()) {
      return NextResponse.json({ error: "userId et newName requis" }, { status: 400 });
    }

    // Get current NAME (may contain trophy HTML tags like <img src="...">)
    const [user] = await prisma.$queryRawUnsafe<{ NAME: string }[]>(
      "SELECT NAME FROM USER WHERE ID_USER = ?", userId
    );
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Extract trophy tags, replace the text part with newName
    const trophyTags = user.NAME.match(/<img[^>]*>/g) ?? [];
    const updatedName = newName.trim() + (trophyTags.length > 0 ? " " + trophyTags.join("") : "");

    await prisma.$executeRawUnsafe(
      "UPDATE USER SET NAME = ? WHERE ID_USER = ?",
      updatedName, userId
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError500("[promotions]", e, "Échec du renommage du participant");
  }
}
