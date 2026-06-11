export const dynamic = "force-dynamic";
export const maxDuration = 300; // 18 effectifs + téléchargements (~1-3 min)

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { syncSeasonPhotos, setPlayerPhotoFromUrl } from "@/lib/photo-sync";

// POST {seasonId, allPlayers?} : récupère les photos des joueurs sélectionnés
// dans les équipes de la saison (phase 6bis du kick-off). Rejouable.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { seasonId, allPlayers } = (await req.json()) as { seasonId?: number; allPlayers?: boolean };
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

  try {
    const report = await syncSeasonPhotos(Number(seasonId), Boolean(allPlayers));
    const message = `${report.downloaded} photos téléchargées, ${report.alreadyLocal} déjà en local, ${report.unmatched.length} joueurs sans photo trouvée${report.failed.length ? `, ${report.failed.length} échecs de téléchargement` : ""}.`;
    return NextResponse.json({ ok: true, message, report });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}

// PATCH {playerId, url} : photo manuelle pour un joueur non matché.
// L'image est téléchargée en local (jamais de hotlink).
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { playerId, url } = (await req.json()) as { playerId?: number; url?: string };
  if (!playerId || !url) return NextResponse.json({ error: "playerId et url requis" }, { status: 400 });

  try {
    const localPath = await setPlayerPhotoFromUrl(Number(playerId), url.trim());
    return NextResponse.json({ ok: true, photoUrl: localPath });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
