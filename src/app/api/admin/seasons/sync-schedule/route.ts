export const dynamic = "force-dynamic";
export const maxDuration = 120; // 1 appel football-data.org + upserts (~5-15 s)

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { seasonKeyFromLabel } from "@/lib/season-key";
import { syncMatchSchedule } from "@/lib/match-schedule-sync";

// POST {seasonId} : synchronise le calendrier Ligue 1 (J1-J38) de la saison
// depuis TheSportsDB. Déclenchable depuis l'admin, rejouable à volonté.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { seasonId } = (await req.json()) as { seasonId?: number };
    if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

    const season = await prisma.season.findUnique({ where: { id: Number(seasonId) } });
    if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });

    const seasonKey = seasonKeyFromLabel(season.label);
    if (!seasonKey) {
      return NextResponse.json(
        { error: `Label « ${season.label} » inexploitable (attendu « 2027 » ou « 2026-2027 »)` },
        { status: 400 }
      );
    }

    const result = await syncMatchSchedule(seasonKey);

    const message =
      result.fetchErrors > 0
        ? `Échec : football-data.org indisponible ou token absent (Admin → Configuration, champ Clé effectifs). Aucun calendrier synchronisé, réessayer plus tard.`
        : result.synced === 0
          ? `Aucun match trouvé pour ${seasonKey} : le calendrier n'est probablement pas encore publié par football-data.org. Réessayer plus tard.`
          : `${result.synced} matchs synchronisés sur ${result.daysWithData} journées (saison ${seasonKey}).` +
            (result.purged > 0 ? ` ${result.purged} ligne(s) tronquées de l'ancienne source purgées.` : "") +
            (result.daysEmpty.length > 0 ? ` Journées sans données : ${result.daysEmpty.join(", ")}.` : "");

    return NextResponse.json({ ok: true, ...result, seasonKey, message });
  } catch (e) {
    return jsonError500("[seasons/sync-schedule]", e, "Échec de la synchronisation du calendrier");
  }
}
