/**
 * GET /api/auction/recap
 * Récap mercato d'une ligue : toutes les acquisitions (mises 'won') de tous
 * les tours dépouillés, groupées par participant, pour chaque phase (été,
 * et hiver quand le module existera — colonne AUCTION.type).
 *
 * Données publiques uniquement : les mises perdues, égalités et retraits
 * restent servis par /api/auction/results selon ses propres règles de
 * visibilité. Cette route n'expose rien qui ne soit pas déjà visible dans
 * le "dépouillement de tous".
 *
 * Accessible à tout utilisateur authentifié, y compris hors de sa ligue
 * (consultation inter-ligues des récaps mercato, demande Pierre 2026-08-18) :
 * pas de contrôle B1 ici, contrairement à /api/auction/results qui reste
 * réservé aux membres de la ligue.
 *
 * Paramètres :
 *   leagueId : number (requis)
 *
 * Réponse :
 *   { phases: [{ auctionId, type, status, budgetPerUser, playersPerUser, recap }] }
 *   recap = { rounds, participants[{ userId, userName, totalSpent, playersWon, acquisitions }], totals }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildMercatoRecap } from "@/lib/auction-mercato-recap";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  if (!leagueId) return NextResponse.json({ error: "leagueId requis" }, { status: 400 });

  // Toutes les phases d'enchères de la ligue (été puis hiver, chronologique).
  const auctionRows = await prisma.$queryRawUnsafe<{
    id: number; status: string; budget_per_user: number; players_per_user: number; type: string | null;
  }[]>(
    "SELECT id, status, budget_per_user, players_per_user, COALESCE(type, 'summer') as type FROM AUCTION WHERE league_id = ? ORDER BY id",
    leagueId
  );

  if (auctionRows.length === 0) {
    return NextResponse.json({ phases: [] });
  }

  // Membres de la ligue (un participant sans acquisition reste listé).
  const participantRows = await prisma.$queryRawUnsafe<{ user_id: number; user_name: string }[]>(
    `SELECT lu.ID_USER as user_id, u.NAME as user_name
     FROM LEAGUE_USER lu JOIN USER u ON lu.ID_USER = u.ID_USER
     WHERE lu.ID_LEAGUE = ?`,
    leagueId
  );
  const participants = participantRows.map((p) => ({
    userId: Number(p.user_id),
    userName: (p.user_name ?? "").replace(/<[^>]*>/g, "").trim(),
  }));

  const phases = [];
  for (const a of auctionRows) {
    const wonRows = await prisma.$queryRawUnsafe<{
      user_id: number; round: number; player_id: number; fname: string; lname: string;
      position: string; club_name: string; amount: number;
    }[]>(
      `SELECT b.user_id, b.round, b.player_id, p.FNAME as fname, p.LNAME as lname,
              p.POSITION as position, c.NAME as club_name, b.amount
       FROM AUCTION_BID b
       JOIN PLAYER p ON b.player_id = p.ID_PLAYER
       JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
       WHERE b.auction_id = ? AND b.status = 'won'`,
      Number(a.id)
    );

    phases.push({
      auctionId: Number(a.id),
      type: a.type ?? "summer",
      status: a.status,
      budgetPerUser: Number(a.budget_per_user),
      playersPerUser: Number(a.players_per_user),
      recap: buildMercatoRecap(
        participants,
        wonRows.map((w) => ({
          userId: Number(w.user_id),
          round: Number(w.round),
          playerId: Number(w.player_id),
          playerName: `${w.fname} ${w.lname}`.trim(),
          position: w.position,
          clubName: w.club_name,
          amount: Number(w.amount),
        }))
      ),
    });
  }

  return NextResponse.json({ phases });
}
