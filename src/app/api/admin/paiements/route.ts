import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

// GET: list all payments
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const payments = await prisma.$queryRawUnsafe<{
    user_id: number; season: string; amount: number; paid: number; paid_at: string | null; notes: string | null; userName: string; leagueId: number | null; leagueName: string | null;
  }[]>(
    `SELECT p.user_id, p.season, p.amount, p.paid, p.paid_at, p.notes, u.NAME as userName,
            l.ID_LEAGUE as leagueId, lg.NAME as leagueName
     FROM PAYMENT p
     JOIN USER u ON p.user_id = u.ID_USER
     LEFT JOIN LEAGUE_USER l ON l.ID_USER = u.ID_USER
     LEFT JOIN \`LEAGUE\` lg ON lg.ID_LEAGUE = l.ID_LEAGUE
     ORDER BY p.paid ASC, u.NAME ASC`
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

  const { userId, paid, notes } = await request.json() as { userId: number; paid: boolean; notes?: string };

  await prisma.$executeRawUnsafe(
    "UPDATE PAYMENT SET paid = ?, paid_at = ?, notes = COALESCE(?, notes) WHERE user_id = ? AND season = '2025-2026'",
    paid ? 1 : 0, paid ? new Date() : null, notes ?? null, userId
  );

  return NextResponse.json({ ok: true });
}
