import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getCurrentSeasonKey, getSeasonScope } from "@/lib/season";

// GET: list payments of the current season
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  // Saison courante uniquement (les lignes PAYMENT sont créées au lancement
  // de la saison, une par participant). La jointure ligue est restreinte aux
  // ligues de la même saison pour ne pas dupliquer les lignes.
  const seasonKey = await getCurrentSeasonKey();
  const scope = await getSeasonScope();
  const scoped = scope.season && scope.hasLeagues;
  const leagueCond = scoped ? "lg.ID_SEASON = ?" : "lg.ID_LEAGUE > 0";
  const params: (string | number)[] = scoped ? [scope.season!.id, seasonKey] : [seasonKey];

  const payments = await prisma.$queryRawUnsafe<{
    user_id: number; season: string; amount: number; paid: number; paid_at: string | null; notes: string | null; userName: string; leagueId: number | null; leagueName: string | null;
  }[]>(
    `SELECT p.user_id, p.season, p.amount, p.paid, p.paid_at, p.notes, u.NAME as userName,
            x.leagueId, x.leagueName
     FROM PAYMENT p
     JOIN USER u ON p.user_id = u.ID_USER
     LEFT JOIN (
       SELECT lu.ID_USER as uid, lg.ID_LEAGUE as leagueId, lg.NAME as leagueName
       FROM LEAGUE_USER lu
       JOIN \`LEAGUE\` lg ON lg.ID_LEAGUE = lu.ID_LEAGUE
       WHERE ${leagueCond}
     ) x ON x.uid = u.ID_USER
     WHERE p.season = ?
     ORDER BY p.paid ASC, u.NAME ASC`,
    ...params
  );

  return NextResponse.json({
    payments: payments.map((p) => ({
      userId: Number(p.user_id),
      userName: (p.userName ?? "").replace(/<[^>]*>/g, "").trim(),
      amount: Number(p.amount),
      paid: p.paid === 1,
      paidAt: p.paid_at,
      notes: p.notes,
      leagueId: p.leagueId ? Number(p.leagueId) : null,
      leagueName: p.leagueName ?? null,
    })),
    totalPaid: payments.filter((p) => p.paid === 1).length,
    totalDue: payments.length,
  });
}

// POST: toggle payment
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { userId, paid, notes } = await request.json() as { userId: number; paid: boolean; notes?: string };

    await prisma.$executeRawUnsafe(
      "UPDATE PAYMENT SET paid = ?, paid_at = ?, notes = COALESCE(?, notes) WHERE user_id = ? AND season = ?",
      paid ? 1 : 0, paid ? new Date() : null, notes ?? null, userId, await getCurrentSeasonKey()
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError500("[paiements]", e, "Échec de l'enregistrement du paiement");
  }
}
