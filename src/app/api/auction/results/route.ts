/**
 * GET /api/auction/results
 * Résultats d'un tour dépouillé pour le participant connecté (BRIEF-06).
 *
 * Paramètres :
 *   leagueId : number (requis)
 *   round     : number (optionnel, défaut = dernier tour dépouillé)
 *
 * Réponse :
 *   auctionId, totalRounds, resolvedRounds[], selectedRound,
 *   myAcquisitions, myLosses, myRemovals, budgetRemaining, playersWon,
 *   playersPerUser, budgetPerUser,
 *   allResults (dépouillement de tous — uniquement si le tour est dépouillé),
 *   auctionStatus ('resolved' | 'tallied' | 'open' | 'closed' | null)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);
  if (!leagueId) return NextResponse.json({ error: "leagueId requis" }, { status: 400 });

  // Récupère l'enchère d'été (inclut 'resolved' contrairement à GET /api/auction)
  const auctionRows = await prisma.$queryRawUnsafe<{
    id: number; status: string; current_round: number; budget_per_user: number; players_per_user: number; round_deadline: Date | null;
  }[]>(
    "SELECT id, status, current_round, budget_per_user, players_per_user, round_deadline FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' ORDER BY id DESC LIMIT 1",
    leagueId
  );

  if (auctionRows.length === 0) {
    return NextResponse.json({ auction: null });
  }

  const auction = {
    id: Number(auctionRows[0].id),
    status: auctionRows[0].status,
    currentRound: Number(auctionRows[0].current_round),
    budgetPerUser: Number(auctionRows[0].budget_per_user),
    playersPerUser: Number(auctionRows[0].players_per_user),
    roundDeadline: auctionRows[0].round_deadline ? new Date(auctionRows[0].round_deadline) : null,
  };

  // Tours dépouillés = tous les rounds où il existe des bids avec statut != 'pending'
  const resolvedRoundRows = await prisma.$queryRawUnsafe<{ round: number }[]>(
    "SELECT DISTINCT round FROM AUCTION_BID WHERE auction_id = ? AND status != 'pending' ORDER BY round",
    auction.id
  );
  const resolvedRounds = resolvedRoundRows.map((r) => Number(r.round));

  // Tour sélectionné : paramètre ou dernier tour dépouillé
  const requestedRound = searchParams.get("round") ? Number(searchParams.get("round")) : null;
  const selectedRound = requestedRound && resolvedRounds.includes(requestedRound)
    ? requestedRound
    : resolvedRounds.length > 0
      ? resolvedRounds[resolvedRounds.length - 1]
      : null;

  if (selectedRound === null) {
    // Pas encore de tour dépouillé : retourner l'état de l'enchère sans résultats
    const myPendingBids = await prisma.$queryRawUnsafe<{
      player_id: number; amount: number; fname: string; lname: string; club_name: string; position: string;
    }[]>(
      `SELECT b.player_id, b.amount, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name, p.POSITION as position
       FROM AUCTION_BID b JOIN PLAYER p ON b.player_id = p.ID_PLAYER JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
       WHERE b.auction_id = ? AND b.round = ? AND b.user_id = ? AND b.status = 'pending'`,
      auction.id, auction.currentRound, userId
    );

    return NextResponse.json({
      auctionId: auction.id,
      auctionStatus: auction.status,
      currentRound: auction.currentRound,
      roundDeadline: auction.roundDeadline?.toISOString() ?? null,
      resolvedRounds: [],
      selectedRound: null,
      budgetPerUser: auction.budgetPerUser,
      playersPerUser: auction.playersPerUser,
      budgetRemaining: auction.budgetPerUser,
      playersWon: 0,
      myAcquisitions: [],
      myLosses: [],
      myRemovals: [],
      myPendingBids: myPendingBids.map((b) => ({
        playerName: `${b.fname} ${b.lname}`.trim(),
        position: b.position,
        clubName: b.club_name,
        amount: Number(b.amount),
      })),
      allResults: null,
    });
  }

  // Mises du participant pour le tour sélectionné
  const myBids = await prisma.$queryRawUnsafe<{
    player_id: number; amount: number; status: string; fname: string; lname: string; club_name: string; position: string;
  }[]>(
    `SELECT b.player_id, b.amount, b.status, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name, p.POSITION as position
     FROM AUCTION_BID b JOIN PLAYER p ON b.player_id = p.ID_PLAYER JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.round = ? AND b.user_id = ?`,
    auction.id, selectedRound, userId
  );

  // Retraits du participant pour le tour sélectionné
  const myRemovals = await prisma.$queryRawUnsafe<{
    player_id: number; amount: number; reason: string; fname: string; lname: string;
  }[]>(
    `SELECT r.player_id, r.amount, r.reason, p.FNAME as fname, p.LNAME as lname
     FROM AUCTION_REMOVAL r JOIN PLAYER p ON r.player_id = p.ID_PLAYER
     WHERE r.auction_id = ? AND r.round = ? AND r.user_id = ?
     ORDER BY r.id`,
    auction.id, selectedRound, userId
  );

  // Budget dépensé (toutes acquisitions, tous tours)
  const [spentRow] = await prisma.$queryRawUnsafe<{ total: number }[]>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    auction.id, userId
  );
  const spent = Number(spentRow.total);
  const budgetRemaining = auction.budgetPerUser - spent;

  // Total joueurs acquis tous tours
  const [wonRow] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    auction.id, userId
  );
  const playersWon = Number(wonRow.cnt);

  // Mises gagnantes du tour (pour "surenchéri par X à Y pts")
  // Note : les égalités (status='tie') sont déjà dans myBids et identifiées par b.status.
  const wonRows = await prisma.$queryRawUnsafe<{
    player_id: number; user_id: number; amount: number; fname: string; lname: string;
  }[]>(
    `SELECT b.player_id, b.user_id, b.amount, u.NAME as lname, '' as fname
     FROM AUCTION_BID b JOIN USER u ON b.user_id = u.ID_USER
     WHERE b.auction_id = ? AND b.round = ? AND b.status = 'won'`,
    auction.id, selectedRound
  );
  const winnerByPlayer = new Map<number, { userName: string; amount: number }>();
  for (const w of wonRows) {
    winnerByPlayer.set(Number(w.player_id), {
      userName: (w.lname ?? "").replace(/<[^>]*>/g, "").trim(),
      amount: Number(w.amount),
    });
  }

  // Acquisitions, mises perdues du tour sélectionné
  const myAcquisitions: {
    playerName: string; position: string; clubName: string; amount: number;
  }[] = [];
  const myLosses: {
    playerName: string; position: string; yourBid: number;
    reasonType: "surenchere" | "tie" | "lost";
    detail: string;
    refund?: number;
  }[] = [];

  for (const b of myBids) {
    const playerName = `${b.fname} ${b.lname}`.trim();
    const playerId = Number(b.player_id);
    const amount = Number(b.amount);

    if (b.status === "won") {
      myAcquisitions.push({ playerName, position: b.position, clubName: b.club_name, amount });
    } else if (b.status === "tie") {
      myLosses.push({
        playerName,
        position: b.position,
        yourBid: amount,
        reasonType: "tie",
        detail: "personne — égalité, remis en jeu au tour suivant",
        refund: amount,
      });
    } else if (b.status === "lost") {
      const winner = winnerByPlayer.get(playerId);
      const detail = winner
        ? `obtenu par ${winner.userName} à ${winner.amount} pts`
        : "surenchéri";
      myLosses.push({
        playerName,
        position: b.position,
        yourBid: amount,
        reasonType: "surenchere",
        detail,
      });
    }
    // statut 'removed' : visible dans myRemovals, pas dans losses
  }

  // Dépouillement de TOUS les participants (transparence, uniquement après dépouillement)
  // On charge toutes les acquisitions du tour et les regroupe par participant
  const allWonRows = await prisma.$queryRawUnsafe<{
    user_id: number; user_name: string; player_id: number; player_fname: string; player_lname: string;
    position: string; club_name: string; amount: number;
  }[]>(
    `SELECT b.user_id, u.NAME as user_name, b.player_id, p.FNAME as player_fname, p.LNAME as player_lname,
            p.POSITION as position, c.NAME as club_name, b.amount
     FROM AUCTION_BID b
     JOIN USER u ON b.user_id = u.ID_USER
     JOIN PLAYER p ON b.player_id = p.ID_PLAYER
     JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.round = ? AND b.status = 'won'
     ORDER BY u.NAME, b.amount DESC`,
    auction.id, selectedRound
  );

  // Tous les participants de la ligue pour le tableau de transparence
  const participantRows = await prisma.$queryRawUnsafe<{ user_id: number; user_name: string }[]>(
    `SELECT lu.ID_USER as user_id, u.NAME as user_name
     FROM LEAGUE_USER lu JOIN USER u ON lu.ID_USER = u.ID_USER
     WHERE lu.ID_LEAGUE = ?`,
    leagueId
  );

  const acquiByUser = new Map<number, typeof allWonRows>();
  for (const row of allWonRows) {
    const uid = Number(row.user_id);
    const arr = acquiByUser.get(uid) ?? [];
    arr.push(row);
    acquiByUser.set(uid, arr);
  }

  const allResults = participantRows.map((p) => {
    const uid = Number(p.user_id);
    const acqs = acquiByUser.get(uid) ?? [];
    return {
      userId: uid,
      userName: (p.user_name ?? "").replace(/<[^>]*>/g, "").trim(),
      isYou: uid === userId,
      acquisitions: acqs.map((a) => ({
        playerName: `${a.player_fname} ${a.player_lname}`.trim(),
        position: a.position,
        clubName: a.club_name,
        amount: Number(a.amount),
      })),
      total: acqs.reduce((s, a) => s + Number(a.amount), 0),
    };
  });

  // Mises pending du tour courant (si le tour sélectionné est le tour courant et qu'il est fermé mais pas encore dépouillé)
  const myPendingBids: { playerName: string; position: string; clubName: string; amount: number }[] = [];

  return NextResponse.json({
    auctionId: auction.id,
    auctionStatus: auction.status,
    currentRound: auction.currentRound,
    roundDeadline: auction.roundDeadline?.toISOString() ?? null,
    resolvedRounds,
    selectedRound,
    budgetPerUser: auction.budgetPerUser,
    playersPerUser: auction.playersPerUser,
    budgetRemaining,
    playersWon,
    myAcquisitions,
    myLosses,
    myRemovals: myRemovals.map((r) => ({
      playerName: `${r.fname} ${r.lname}`.trim(),
      amount: Number(r.amount),
      reason: r.reason,
    })),
    myPendingBids,
    allResults,
  });
}
