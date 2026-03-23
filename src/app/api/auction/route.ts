import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: get auction state for current user
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);

  // Find active auction
  const auction = await prisma.$queryRawUnsafe<{
    id: number; status: string; current_round: number; budget_per_user: number; players_per_user: number;
  }[]>(
    "SELECT id, status, current_round, budget_per_user, players_per_user FROM AUCTION WHERE league_id = ? AND status != 'resolved' ORDER BY id DESC LIMIT 1",
    leagueId
  );

  if (auction.length === 0) {
    return NextResponse.json({ auction: null });
  }

  const a = {
    id: Number(auction[0].id),
    status: auction[0].status,
    current_round: Number(auction[0].current_round),
    budget_per_user: Number(auction[0].budget_per_user),
    players_per_user: Number(auction[0].players_per_user),
  };

  // My spent budget (won bids)
  const [spentRow] = await prisma.$queryRawUnsafe<{ total: number }[]>(
    "SELECT COALESCE(SUM(amount),0) as total FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    a.id, userId
  );
  const spent = Number(spentRow.total);
  const budget = a.budget_per_user - spent;

  // My won players count
  const [wonRow] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    a.id, userId
  );
  const playersWon = Number(wonRow.cnt);

  // My bids for current round
  const myBids = await prisma.$queryRawUnsafe<{
    player_id: number; amount: number; status: string; fname: string; lname: string; club_name: string;
  }[]>(
    `SELECT b.player_id, b.amount, b.status, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name
     FROM AUCTION_BID b JOIN PLAYER p ON b.player_id = p.ID_PLAYER JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.round = ? AND b.user_id = ?`,
    a.id, a.current_round, userId
  );

  // My won players (all rounds)
  const wonPlayers = await prisma.$queryRawUnsafe<{
    player_id: number; amount: number; fname: string; lname: string; club_name: string; position: string;
  }[]>(
    `SELECT b.player_id, b.amount, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name, p.POSITION as position
     FROM AUCTION_BID b JOIN PLAYER p ON b.player_id = p.ID_PLAYER JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.user_id = ? AND b.status = 'won'
     ORDER BY b.amount DESC`,
    a.id, userId
  );

  return NextResponse.json({
    auction: {
      id: Number(a.id),
      status: a.status,
      currentRound: Number(a.current_round),
      isOpen: a.status === "open",
    },
    budget,
    playersWon,
    playersNeeded: a.players_per_user - playersWon,
    myBids: myBids.map((b) => ({
      playerId: Number(b.player_id),
      playerName: `${b.fname} ${b.lname}`.trim(),
      clubName: b.club_name,
      amount: Number(b.amount),
      status: b.status,
    })),
    wonPlayers: wonPlayers.map((p) => ({
      playerId: Number(p.player_id),
      playerName: `${p.fname} ${p.lname}`.trim(),
      clubName: p.club_name,
      position: p.position,
      amount: Number(p.amount),
    })),
  });
}

// POST: place bids
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { leagueId, bids } = await request.json() as {
    leagueId: number;
    bids: { playerId: number; amount: number }[];
  };

  // Find open auction
  const auction = await prisma.$queryRawUnsafe<{
    id: number; status: string; current_round: number; budget_per_user: number;
  }[]>(
    "SELECT id, status, current_round, budget_per_user FROM AUCTION WHERE league_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1",
    leagueId
  );

  if (auction.length === 0) {
    return NextResponse.json({ error: "Pas d'enchère ouverte" }, { status: 400 });
  }

  const a = {
    id: Number(auction[0].id),
    status: auction[0].status,
    current_round: Number(auction[0].current_round),
    budget_per_user: Number(auction[0].budget_per_user),
  };

  // Calculate remaining budget
  const [spentRow] = await prisma.$queryRawUnsafe<{ total: number }[]>(
    "SELECT COALESCE(SUM(amount),0) as total FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    a.id, userId
  );
  const spent = Number(spentRow.total);
  const budget = a.budget_per_user - spent;

  // Validate total bids don't exceed budget
  const totalBids = bids.reduce((sum, b) => sum + b.amount, 0);
  if (totalBids > budget) {
    return NextResponse.json({ error: `Budget insuffisant (${budget} pts restants, ${totalBids} misés)` }, { status: 400 });
  }

  // Validate amounts > 0
  if (bids.some((b) => b.amount <= 0)) {
    return NextResponse.json({ error: "Les mises doivent être > 0" }, { status: 400 });
  }

  // Delete existing bids for this round (replace)
  await prisma.$executeRawUnsafe(
    "DELETE FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND user_id = ? AND status = 'pending'",
    a.id, a.current_round, userId
  );

  // Insert new bids
  for (const bid of bids) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO AUCTION_BID (auction_id, round, user_id, player_id, amount, status) VALUES (?, ?, ?, ?, ?, 'pending')",
      a.id, a.current_round, userId, bid.playerId, bid.amount
    );
  }

  return NextResponse.json({ ok: true, message: `${bids.length} enchère(s) placée(s)` });
}
