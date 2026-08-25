export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

interface LeagueRow { id: number; name: string }
interface ParticipantRow { leagueId: number; userId: number; userName: string }

// Trophées stockés en balises <img> dans USER.NAME (héritage du site PHP).
// Clé canonique -> src de l'image. Toute écriture passe par cette liste blanche.
const TROPHY_FILES: Record<string, string> = {
  etoile_rouge: "/img/etoile_rouge.gif",
  etoile_jaune: "/img/etoile_jaune.gif",
  etoile_noire: "/img/etoile_noire.gif",
  etoile_bleue: "/img/etoile_bleue.gif",
  etoile_verte: "/img/etoile_verte.png",
  coupe: "/img/coupe.gif",
  champion_automne: "/img/champion_automne.png",
  ballon_dor: "/img/ballon_dor.png",
};

// Parse les balises img de USER.NAME : compte par clé canonique (en dépliant le
// suffixe numérique legacy etoile_jaune3.gif = 3 étoiles), et conserve verbatim
// les balises non reconnues pour ne jamais les détruire à la réécriture.
function parseTrophyTags(rawName: string): { counts: Record<string, number>; unknownTags: string[] } {
  const counts: Record<string, number> = {};
  const unknownTags: string[] = [];
  const imgRegex = /<img[^>]*>/gi;
  for (const tag of rawName.match(imgRegex) ?? []) {
    const m = tag.match(/src="[^"]*?([a-z_]+?)(\d*)\.(gif|png)"/i);
    const base = m?.[1]?.toLowerCase();
    if (m && base && TROPHY_FILES[base]) {
      const n = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
      counts[base] = (counts[base] ?? 0) + n;
    } else {
      unknownTags.push(tag);
    }
  }
  return { counts, unknownTags };
}

// GET: list all leagues with their participants
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  // Les divisions des saisons clôturées sont exclues : seules les ligues de la
  // saison en préparation ou en cours sont candidates aux mouvements.
  const leagues = await prisma.$queryRawUnsafe<LeagueRow[]>(
    `SELECT l.ID_LEAGUE as id, l.NAME as name
     FROM LEAGUE l
     LEFT JOIN SEASON s ON l.ID_SEASON = s.ID_SEASON
     WHERE s.ID_SEASON IS NULL OR s.STATUS != 'CLOSED'
     ORDER BY l.NAME`
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
      .map((p) => ({
        userId: Number(p.userId),
        name: clean(p.userName),
        trophies: parseTrophyTags(p.userName).counts,
      }))
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

// PUT: set a participant's trophies (rewrites the img tags in USER.NAME,
// preserves the pseudo and any unrecognized legacy tags)
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const { userId, trophies } = await request.json() as {
      userId: number;
      trophies: Record<string, number>;
    };
    if (!userId || typeof trophies !== "object" || trophies === null) {
      return NextResponse.json({ error: "userId et trophies requis" }, { status: 400 });
    }
    for (const [key, count] of Object.entries(trophies)) {
      if (!TROPHY_FILES[key]) {
        return NextResponse.json({ error: `Trophée inconnu : ${key}` }, { status: 400 });
      }
      if (!Number.isInteger(count) || count < 0 || count > 30) {
        return NextResponse.json({ error: `Nombre invalide pour ${key}` }, { status: 400 });
      }
    }

    const [user] = await prisma.$queryRawUnsafe<{ NAME: string }[]>(
      "SELECT NAME FROM USER WHERE ID_USER = ?", userId
    );
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const cleanName = user.NAME.replace(/<[^>]*>/g, "").trim();
    const { unknownTags } = parseTrophyTags(user.NAME);

    // Ordre stable : celui de la liste blanche. Une balise par trophée
    // (les variantes condensées legacy etoile_x3.gif ne sont plus réécrites).
    const tags: string[] = [];
    for (const [key, src] of Object.entries(TROPHY_FILES)) {
      const n = trophies[key] ?? 0;
      for (let i = 0; i < n; i++) tags.push(`<img src="${src}">`);
    }
    tags.push(...unknownTags);

    const updatedName = cleanName + (tags.length > 0 ? " " + tags.join("") : "");
    await prisma.$executeRawUnsafe(
      "UPDATE USER SET NAME = ? WHERE ID_USER = ?",
      updatedName, userId
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError500("[promotions]", e, "Échec de la mise à jour des trophées");
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
