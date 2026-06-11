import { NextResponse } from "next/server";
import { prisma, inParams } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDeadlinePassed, deadlineErrorMessage } from "@/lib/auction-deadline";
import { getSeasonFilters } from "@/lib/season";
import { isNamedGoalkeeper } from "@/lib/club-goalkeeper";

// GET: get auction state for current user
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);

  // Find active auction (any type)
  const auction = await prisma.$queryRawUnsafe<{
    id: number; status: string; current_round: number; budget_per_user: number; players_per_user: number; type: string; round_deadline: Date | null;
  }[]>(
    "SELECT id, status, current_round, budget_per_user, players_per_user, COALESCE(type, 'summer') as type, round_deadline FROM AUCTION WHERE league_id = ? AND status != 'resolved' ORDER BY id DESC LIMIT 1",
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
    type: auction[0].type || "summer",
    round_deadline: auction[0].round_deadline ? new Date(auction[0].round_deadline) : null,
  };

  const isWinter = a.type === "winter";

  // Determine budget: for winter, read from AUCTION_BUDGET; for summer, use budget_per_user
  let userBudgetTotal = a.budget_per_user;
  if (isWinter) {
    const budgetRows = await prisma.$queryRawUnsafe<{ budget: number }[]>(
      "SELECT budget FROM AUCTION_BUDGET WHERE auction_id = ? AND user_id = ?",
      a.id, userId
    );
    if (budgetRows.length > 0) {
      userBudgetTotal = Number(budgetRows[0].budget);
    }
  }

  // My spent budget (won bids)
  const [spentRow] = await prisma.$queryRawUnsafe<{ total: number }[]>(
    "SELECT COALESCE(SUM(amount),0) as total FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    a.id, userId
  );
  const spent = Number(spentRow.total);
  const budget = userBudgetTotal - spent;

  // My won players count
  const [wonRow] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    a.id, userId
  );
  const playersWon = Number(wonRow.cnt);

  // My bids for current round (include player_out for winter)
  const myBids = await prisma.$queryRawUnsafe<{
    player_id: number; amount: number; status: string; fname: string; lname: string; club_name: string; player_out_id: number | null;
  }[]>(
    `SELECT b.player_id, b.amount, b.status, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name, b.player_out_id
     FROM AUCTION_BID b JOIN PLAYER p ON b.player_id = p.ID_PLAYER JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.round = ? AND b.user_id = ?`,
    a.id, a.current_round, userId
  );

  // Get player_out names for winter bids
  const playerOutIds = myBids.map((b) => b.player_out_id).filter((id): id is number => id !== null && id > 0);
  let playerOutNameMap = new Map<number, string>();
  if (playerOutIds.length > 0) {
    const [ph, vs] = inParams(playerOutIds);
    const outPlayers = await prisma.$queryRawUnsafe<{ id: number; fname: string; lname: string }[]>(
      `SELECT ID_PLAYER as id, FNAME as fname, LNAME as lname FROM PLAYER WHERE ID_PLAYER IN (${ph})`, ...vs
    );
    playerOutNameMap = new Map(outPlayers.map((p) => [Number(p.id), `${p.fname} ${p.lname}`.trim()]));
  }

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

  // For winter: get current squad (for player_out selector)
  let squad: { playerId: number; playerName: string; position: string; clubName: string }[] = [];
  if (isWinter) {
    const currentDay = (await prisma.score.findFirst({ orderBy: { day: "desc" } }))?.day ?? 1;
    const teamMembers = await prisma.$queryRawUnsafe<{
      player_id: number; fname: string; lname: string; position: string; club_name: string;
    }[]>(
      `SELECT t.ID_PLAYER as player_id, p.FNAME as fname, p.LNAME as lname, p.POSITION as position, c.NAME as club_name
       FROM TEAM t
       JOIN PLAYER p ON t.ID_PLAYER = p.ID_PLAYER
       JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
       WHERE t.ID_LEAGUE = ? AND t.ID_USER = ? AND t.DAY_FIRST <= ? AND t.DAY_LAST >= ?
       ORDER BY p.POSITION, p.LNAME`,
      leagueId, userId, currentDay, currentDay
    );

    // Exclude players already released in won winter bids
    const releasedIds = new Set<number>();
    const wonBidsWithOut = await prisma.$queryRawUnsafe<{ player_out_id: number }[]>(
      "SELECT player_out_id FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won' AND player_out_id IS NOT NULL",
      a.id, userId
    );
    wonBidsWithOut.forEach((b) => releasedIds.add(Number(b.player_out_id)));

    squad = teamMembers
      .filter((m) => !releasedIds.has(Number(m.player_id)))
      .map((m) => ({
        playerId: Number(m.player_id),
        playerName: `${m.fname} ${m.lname}`.trim(),
        position: m.position,
        clubName: m.club_name,
      }));
  }

  return NextResponse.json({
    auction: {
      id: Number(a.id),
      status: a.status,
      currentRound: Number(a.current_round),
      isOpen: a.status === "open",
      type: a.type,
      roundDeadline: a.round_deadline ? a.round_deadline.toISOString() : null,
    },
    budget,
    playersWon,
    playersNeeded: isWinter ? 0 : a.players_per_user - playersWon,
    myBids: myBids.map((b) => ({
      playerId: Number(b.player_id),
      playerName: `${b.fname} ${b.lname}`.trim(),
      clubName: b.club_name,
      amount: Number(b.amount),
      status: b.status,
      playerOutId: b.player_out_id ? Number(b.player_out_id) : null,
      playerOutName: b.player_out_id ? (playerOutNameMap.get(Number(b.player_out_id)) ?? null) : null,
    })),
    wonPlayers: wonPlayers.map((p) => ({
      playerId: Number(p.player_id),
      playerName: `${p.fname} ${p.lname}`.trim(),
      clubName: p.club_name,
      position: p.position,
      amount: Number(p.amount),
    })),
    ...(isWinter ? { squad } : {}),
  });
}

// POST: place bids
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const userId = (session.user as { userId?: number }).userId;
  if (!userId) return NextResponse.json({ error: "User ID manquant" }, { status: 401 });

  const { leagueId, bids } = await request.json() as {
    leagueId: number;
    bids: { playerId: number; amount: number; playerOutId?: number }[];
  };

  // Find open auction
  const auction = await prisma.$queryRawUnsafe<{
    id: number; status: string; current_round: number; budget_per_user: number; type: string; round_deadline: Date | null;
  }[]>(
    "SELECT id, status, current_round, budget_per_user, COALESCE(type, 'summer') as type, round_deadline FROM AUCTION WHERE league_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1",
    leagueId
  );

  if (auction.length === 0) {
    return NextResponse.json({ error: "Pas d'enchere ouverte" }, { status: 400 });
  }

  const a = {
    id: Number(auction[0].id),
    status: auction[0].status,
    current_round: Number(auction[0].current_round),
    budget_per_user: Number(auction[0].budget_per_user),
    type: auction[0].type || "summer",
    round_deadline: auction[0].round_deadline ? new Date(auction[0].round_deadline) : null,
  };

  // Rejet tolérance 0 si l'heure butoir est dépassée (timestamp serveur fait foi)
  if (isDeadlinePassed(a.round_deadline, new Date())) {
    return NextResponse.json(
      { error: deadlineErrorMessage(a.round_deadline!) },
      { status: 403 }
    );
  }

  const isWinter = a.type === "winter";

  // Determine user's budget
  let userBudgetTotal = a.budget_per_user;
  if (isWinter) {
    const budgetRows = await prisma.$queryRawUnsafe<{ budget: number }[]>(
      "SELECT budget FROM AUCTION_BUDGET WHERE auction_id = ? AND user_id = ?",
      a.id, userId
    );
    if (budgetRows.length > 0) {
      userBudgetTotal = Number(budgetRows[0].budget);
    }
  }

  // Calculate remaining budget
  const [spentRow] = await prisma.$queryRawUnsafe<{ total: number }[]>(
    "SELECT COALESCE(SUM(amount),0) as total FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    a.id, userId
  );
  const spent = Number(spentRow.total);
  const budget = userBudgetTotal - spent;

  // Validate total bids don't exceed budget
  const totalBids = bids.reduce((sum, b) => sum + b.amount, 0);
  if (totalBids > budget) {
    return NextResponse.json({ error: `Budget insuffisant (${budget} pts restants, ${totalBids} mises)` }, { status: 400 });
  }

  // Validate amounts > 0
  if (bids.some((b) => b.amount <= 0)) {
    return NextResponse.json({ error: "Les mises doivent etre > 0" }, { status: 400 });
  }

  // For winter: validate each bid has a player_out_id
  if (isWinter) {
    for (const bid of bids) {
      if (!bid.playerOutId) {
        return NextResponse.json({ error: "Chaque enchere doit designer un joueur sortant (1 IN = 1 OUT)" }, { status: 400 });
      }
    }
  }

  // B1 : garde serveur — chaque playerId doit exister dans le perimetre de la
  // saison courante ET ne pas etre un gardien nomme (position Gardien sans
  // prefixe gardiens_). Les pseudo-gardiens « Gardiens [Club] » sont autorisés.
  if (bids.length > 0) {
    const bidPlayerIds = bids.map((b) => b.playerId);
    const [ph, vs] = inParams(bidPlayerIds);
    const seasonFilters = await getSeasonFilters();
    // On charge seulement les colonnes utiles a la validation.
    const foundPlayers = await prisma.$queryRawUnsafe<{
      id: number; position: string; link: string | null;
    }[]>(
      `SELECT p.ID_PLAYER as id, p.POSITION as position, p.LINK as link
       FROM PLAYER p
       WHERE p.ID_PLAYER IN (${ph})`,
      ...vs
    );
    // Filtrage selon le perimetre saison (seasonId NULL = legacy : pas de scope).
    let scopedPlayerIds: Set<number>;
    if ("seasonId" in seasonFilters.player) {
      // La saison courante scope les joueurs : on exclut ceux hors saison.
      const seasonId = (seasonFilters.player as { seasonId: number }).seasonId;
      const scopedRows = await prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT p.ID_PLAYER as id FROM PLAYER p
         WHERE p.ID_PLAYER IN (${ph}) AND p.ID_SEASON = ?`,
        ...vs, seasonId
      );
      scopedPlayerIds = new Set(scopedRows.map((r) => Number(r.id)));
    } else {
      scopedPlayerIds = new Set(foundPlayers.map((r) => Number(r.id)));
    }

    for (const bid of bids) {
      if (!scopedPlayerIds.has(bid.playerId)) {
        return NextResponse.json(
          { error: `Joueur #${bid.playerId} inexistant ou hors perimetre de la saison courante.` },
          { status: 400 }
        );
      }
      const player = foundPlayers.find((p) => Number(p.id) === bid.playerId);
      if (player && isNamedGoalkeeper({ position: player.position, link: player.link })) {
        return NextResponse.json(
          { error: `Joueur #${bid.playerId} est un gardien nomme : misez sur le pseudo-joueur « Gardiens [Club] » correspondant.` },
          { status: 400 }
        );
      }
    }
  }

  // Delete existing bids for this round (replace)
  await prisma.$executeRawUnsafe(
    "DELETE FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND user_id = ? AND status = 'pending'",
    a.id, a.current_round, userId
  );

  // Insert new bids
  for (const bid of bids) {
    if (isWinter && bid.playerOutId) {
      await prisma.$executeRawUnsafe(
        "INSERT INTO AUCTION_BID (auction_id, round, user_id, player_id, amount, status, player_out_id) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        a.id, a.current_round, userId, bid.playerId, bid.amount, bid.playerOutId
      );
    } else {
      await prisma.$executeRawUnsafe(
        "INSERT INTO AUCTION_BID (auction_id, round, user_id, player_id, amount, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        a.id, a.current_round, userId, bid.playerId, bid.amount
      );
    }
  }

  return NextResponse.json({ ok: true, message: `${bids.length} enchere(s) placee(s)` });
}
