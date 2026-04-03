import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { requireAdmin } from "@/lib/admin-auth";

// GET: auction status for a league
export async function GET(request: Request) {
  // Auth temporarily disabled for debugging
  // const auth = await requireAdmin();
  // if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);

  const auction = await prisma.$queryRawUnsafe<{
    id: number; league_id: number; status: string; current_round: number; budget_per_user: number; players_per_user: number;
  }[]>(
    "SELECT * FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' ORDER BY id DESC LIMIT 1",
    leagueId
  );

  if (auction.length === 0) {
    return NextResponse.json({ auction: null });
  }

  // Convert BigInt values from raw query
  const a = {
    id: Number(auction[0].id),
    league_id: Number(auction[0].league_id),
    status: auction[0].status,
    current_round: Number(auction[0].current_round),
    budget_per_user: Number(auction[0].budget_per_user),
    players_per_user: Number(auction[0].players_per_user),
  };

  // Get bids for current round
  const bids = await prisma.$queryRawUnsafe<{
    user_id: number; player_id: number; amount: number; status: string;
    fname: string; lname: string; club_name: string;
  }[]>(
    `SELECT b.user_id, b.player_id, b.amount, b.status, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name
     FROM AUCTION_BID b
     JOIN PLAYER p ON b.player_id = p.ID_PLAYER
     JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.round = ?
     ORDER BY b.amount DESC`,
    a.id, a.current_round
  );

  // Get participants + their remaining budget
  const participants = await prisma.$queryRawUnsafe<{ userId: number; userName: string }[]>(
    `SELECT lu.ID_USER as userId, u.NAME as userName
     FROM LEAGUE_USER lu JOIN USER u ON lu.ID_USER = u.ID_USER
     WHERE lu.ID_LEAGUE = ?`,
    leagueId
  );

  // Calculate spent per user (won bids across all rounds)
  const spent = await prisma.$queryRawUnsafe<{ user_id: number; total_spent: number }[]>(
    `SELECT user_id, SUM(amount) as total_spent FROM AUCTION_BID
     WHERE auction_id = ? AND status = 'won'
     GROUP BY user_id`,
    a.id
  );
  const spentMap = new Map(spent.map((s) => [Number(s.user_id), Number(s.total_spent)]));

  // Count players won per user
  const won = await prisma.$queryRawUnsafe<{ user_id: number; cnt: number }[]>(
    `SELECT user_id, COUNT(*) as cnt FROM AUCTION_BID
     WHERE auction_id = ? AND status = 'won'
     GROUP BY user_id`,
    a.id
  );
  const wonMap = new Map(won.map((w) => [Number(w.user_id), Number(w.cnt)]));

  const participantData = participants.map((p) => ({
    userId: Number(p.userId),
    userName: (p.userName ?? "").replace(/<[^>]*>/g, "").trim(),
    budget: a.budget_per_user - (spentMap.get(Number(p.userId)) ?? 0),
    playersWon: wonMap.get(Number(p.userId)) ?? 0,
    playersNeeded: a.players_per_user - (wonMap.get(Number(p.userId)) ?? 0),
  }));

  return NextResponse.json({
    auction: {
      id: Number(a.id),
      leagueId: Number(a.league_id),
      status: a.status,
      currentRound: Number(a.current_round),
      budget: a.budget_per_user,
      playersPerUser: a.players_per_user,
    },
    bids: bids.map((b) => ({
      userId: Number(b.user_id),
      playerId: Number(b.player_id),
      playerName: `${b.fname} ${b.lname}`.trim(),
      clubName: b.club_name,
      amount: Number(b.amount),
      status: b.status,
    })),
    participants: participantData,
  });
}

// POST: admin actions (open, close-round, resolve-round, close-auction)
export async function POST(request: Request) {
  // Auth temporarily disabled — TODO: re-enable once session is stable
  // const auth = await requireAdmin();
  // if (auth.error) return auth.error;

  const { action, leagueId } = await request.json() as {
    action: "open" | "close-round" | "resolve-round" | "resolve-tiebreak" | "close-auction";
    leagueId: number;
  };

  if (action === "open") {
    // Create or reopen auction
    const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
      "SELECT id FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' AND status != 'resolved' ORDER BY id DESC LIMIT 1",
      leagueId
    );

    if (existing.length > 0) {
      // Reopen existing
      await prisma.$executeRawUnsafe(
        "UPDATE AUCTION SET status = 'open', current_round = current_round + 1 WHERE id = ?",
        existing[0].id
      );
      return NextResponse.json({ ok: true, message: "Tour suivant ouvert" });
    }

    // Create new auction
    await prisma.$executeRawUnsafe(
      "INSERT INTO AUCTION (league_id, status, current_round) VALUES (?, 'open', 1)",
      leagueId
    );
    return NextResponse.json({ ok: true, message: "Enchère ouverte (tour 1)" });
  }

  if (action === "close-round") {
    // Close bidding for current round
    await prisma.$executeRawUnsafe(
      "UPDATE AUCTION SET status = 'closed' WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' AND status = 'open'",
      leagueId
    );
    return NextResponse.json({ ok: true, message: "Tour fermé aux enchères" });
  }

  if (action === "resolve-round") {
    // Resolve current round: highest bid wins, ties void
    const auction = await prisma.$queryRawUnsafe<{ id: number; current_round: number }[]>(
      "SELECT id, current_round FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' ORDER BY id DESC LIMIT 1",
      leagueId
    );
    if (auction.length === 0) return NextResponse.json({ error: "Pas d'enchère" }, { status: 400 });

    const aId = Number(auction[0].id);
    const round = Number(auction[0].current_round);

    // Get all pending bids for this round
    const bids = await prisma.$queryRawUnsafe<{
      id: number; user_id: number; player_id: number; amount: number;
    }[]>(
      "SELECT id, user_id, player_id, amount FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND status = 'pending' ORDER BY player_id, amount DESC",
      aId, round
    );

    // Group by player
    const byPlayer = new Map<number, typeof bids>();
    bids.forEach((b) => {
      const arr = byPlayer.get(Number(b.player_id)) ?? [];
      arr.push(b);
      byPlayer.set(Number(b.player_id), arr);
    });

    let won = 0, lost = 0, tied = 0;

    for (const [, playerBids] of Array.from(byPlayer.entries())) {
      const sorted = playerBids.sort((a, b) => Number(b.amount) - Number(a.amount));
      const highest = Number(sorted[0].amount);
      const topBids = sorted.filter((b) => Number(b.amount) === highest);

      if (topBids.length === 1) {
        // Winner
        await prisma.$executeRawUnsafe(
          "UPDATE AUCTION_BID SET status = 'won' WHERE id = ?", Number(topBids[0].id)
        );
        won++;
        // Mark others as lost
        for (const b of sorted.slice(1)) {
          await prisma.$executeRawUnsafe(
            "UPDATE AUCTION_BID SET status = 'lost' WHERE id = ?", Number(b.id)
          );
          lost++;
        }
      } else {
        // Tie — all top bids voided, lower bids lost
        for (const b of topBids) {
          await prisma.$executeRawUnsafe(
            "UPDATE AUCTION_BID SET status = 'tie' WHERE id = ?", Number(b.id)
          );
          tied++;
        }
        for (const b of sorted.slice(topBids.length)) {
          await prisma.$executeRawUnsafe(
            "UPDATE AUCTION_BID SET status = 'lost' WHERE id = ?", Number(b.id)
          );
          lost++;
        }
      }
    }

    // Transition auction status to 'resolved' so buttons can proceed to next round
    await prisma.$executeRawUnsafe(
      "UPDATE AUCTION SET status = 'resolved' WHERE id = ?",
      aId
    );

    return NextResponse.json({
      ok: true,
      message: `Tour ${round} résolu : ${won} joueurs attribués, ${tied} égalités, ${lost} enchères perdues`,
    });
  }

  if (action === "resolve-tiebreak") {
    // Resolve ties by random draw (for last round when ties persist)
    const auction = await prisma.$queryRawUnsafe<{ id: number; current_round: number }[]>(
      "SELECT id, current_round FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' ORDER BY id DESC LIMIT 1",
      leagueId
    );
    if (auction.length === 0) return NextResponse.json({ error: "Pas d'enchère" }, { status: 400 });

    const aId = Number(auction[0].id);
    const round = Number(auction[0].current_round);

    // Find all ties in current round
    const ties = await prisma.$queryRawUnsafe<{
      id: number; user_id: number; player_id: number; amount: number;
    }[]>(
      "SELECT id, user_id, player_id, amount FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND status = 'tie'",
      aId, round
    );

    // Group ties by player
    const tiesByPlayer = new Map<number, typeof ties>();
    ties.forEach((b) => {
      const arr = tiesByPlayer.get(Number(b.player_id)) ?? [];
      arr.push(b);
      tiesByPlayer.set(Number(b.player_id), arr);
    });

    let resolved = 0;
    const results: string[] = [];

    for (const [playerId, playerTies] of Array.from(tiesByPlayer.entries())) {
      // Random draw: pick one winner
      const winnerIdx = Math.floor(Math.random() * playerTies.length);
      for (let i = 0; i < playerTies.length; i++) {
        const status = i === winnerIdx ? "won" : "lost";
        await prisma.$executeRawUnsafe(
          "UPDATE AUCTION_BID SET status = ? WHERE id = ?",
          status, Number(playerTies[i].id)
        );
      }
      resolved++;

      // Get player name for message
      const player = await prisma.player.findUnique({ where: { id: playerId } });
      const winnerUser = await prisma.user.findUnique({ where: { id: Number(playerTies[winnerIdx].user_id) } });
      const pName = player ? `${player.fname} ${player.lname}`.trim() : `#${playerId}`;
      const wName = winnerUser ? winnerUser.name.replace(/<[^>]*>/g, "").trim() : `#${playerTies[winnerIdx].user_id}`;
      results.push(`${pName} → ${wName} (tirage au sort)`);
    }

    // Check if there are still pending/tie bids remaining; if not, mark as resolved
    const remaining = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      "SELECT COUNT(*) as cnt FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND status IN ('pending', 'tie')",
      aId, round
    );
    if (Number(remaining[0]?.cnt ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "UPDATE AUCTION SET status = 'resolved' WHERE id = ?",
        aId
      );
    }

    return NextResponse.json({
      ok: true,
      message: `${resolved} égalité(s) résolue(s) par tirage au sort`,
      details: results,
    });
  }

  if (action === "close-auction") {
    await prisma.$executeRawUnsafe(
      "UPDATE AUCTION SET status = 'resolved' WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' AND status != 'resolved'",
      leagueId
    );
    return NextResponse.json({ ok: true, message: "Enchère terminée" });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
