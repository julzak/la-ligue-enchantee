import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma, inParams } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

// GET: winter auction status + standings-based budgets for a league
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);

  if (!leagueId) return NextResponse.json({ auction: null, participants: [] });

  // Get current standings to compute winter budgets
  // Budget formula: 1st = 10 pts, then +2 per rank (2nd=12, 3rd=14, ..., 18th=44)
  const currentDay = (await prisma.score.findFirst({ orderBy: { day: "desc" } }))?.day ?? 1;

  // Get cumulative totals from STATS_USER
  const allStats = await prisma.$queryRawUnsafe<{ userId: number; total: number }[]>(
    `SELECT ID_USER as userId, SUM(PTS_TOT) as total
     FROM STATS_USER WHERE ID_LEAGUE = ? AND DAY <= ?
     GROUP BY ID_USER ORDER BY total DESC`,
    leagueId, currentDay
  );

  // Get user names
  const leagueUsers = await prisma.$queryRawUnsafe<{ userId: number; userName: string }[]>(
    `SELECT lu.ID_USER as userId, u.NAME as userName
     FROM LEAGUE_USER lu JOIN USER u ON lu.ID_USER = u.ID_USER
     WHERE lu.ID_LEAGUE = ?`,
    leagueId
  );
  const userNameMap = new Map(leagueUsers.map((u) => [Number(u.userId), (u.userName ?? "").replace(/<[^>]*>/g, "").trim()]));

  // Build standings with rank-based budgets
  const standings = allStats.map((s, i) => {
    const rank = i + 1;
    const winterBudget = 10 + (rank - 1) * 2; // 1st=10, 2nd=12, ..., 18th=44
    return {
      userId: Number(s.userId),
      userName: userNameMap.get(Number(s.userId)) ?? `User ${s.userId}`,
      rank,
      totalPoints: Math.round(Number(s.total) * 10) / 10,
      winterBudget,
    };
  });

  // Find existing winter auction
  const auction = await prisma.$queryRawUnsafe<{
    id: number; league_id: number; status: string; current_round: number; type: string;
  }[]>(
    "SELECT * FROM AUCTION WHERE league_id = ? AND type = 'winter' ORDER BY id DESC LIMIT 1",
    leagueId
  );

  if (auction.length === 0) {
    return NextResponse.json({ auction: null, participants: standings });
  }

  const a = {
    id: Number(auction[0].id),
    league_id: Number(auction[0].league_id),
    status: auction[0].status,
    current_round: Number(auction[0].current_round),
  };

  // Get bids for current round (including player_out info)
  const bids = await prisma.$queryRawUnsafe<{
    user_id: number; player_id: number; amount: number; status: string;
    fname: string; lname: string; club_name: string; player_out_id: number | null;
  }[]>(
    `SELECT b.user_id, b.player_id, b.amount, b.status, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name, b.player_out_id
     FROM AUCTION_BID b
     JOIN PLAYER p ON b.player_id = p.ID_PLAYER
     JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.round = ?
     ORDER BY b.amount DESC`,
    a.id, a.current_round
  );

  // Get player_out names
  const playerOutIds = bids.map((b) => b.player_out_id).filter((id): id is number => id !== null && id > 0);
  let playerOutMap = new Map<number, string>();
  if (playerOutIds.length > 0) {
    const [ph, vs] = inParams(playerOutIds);
    const outPlayers = await prisma.$queryRawUnsafe<{ id: number; fname: string; lname: string }[]>(
      `SELECT ID_PLAYER as id, FNAME as fname, LNAME as lname FROM PLAYER WHERE ID_PLAYER IN (${ph})`, ...vs
    );
    playerOutMap = new Map(outPlayers.map((p) => [Number(p.id), `${p.fname} ${p.lname}`.trim()]));
  }

  // Get per-user winter budget (stored in AUCTION_BUDGET table)
  const userBudgets = await prisma.$queryRawUnsafe<{ user_id: number; budget: number }[]>(
    "SELECT user_id, budget FROM AUCTION_BUDGET WHERE auction_id = ?",
    a.id
  );
  const budgetMap = new Map(userBudgets.map((b) => [Number(b.user_id), Number(b.budget)]));

  // Calculate spent per user (won bids)
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

  // Merge standings with auction data
  const participantData = standings.map((s) => ({
    ...s,
    assignedBudget: budgetMap.get(s.userId) ?? s.winterBudget,
    budgetRemaining: (budgetMap.get(s.userId) ?? s.winterBudget) - (spentMap.get(s.userId) ?? 0),
    playersWon: wonMap.get(s.userId) ?? 0,
  }));

  return NextResponse.json({
    auction: {
      id: a.id,
      leagueId: a.league_id,
      status: a.status,
      currentRound: a.current_round,
      type: "winter",
    },
    bids: bids.map((b) => ({
      userId: Number(b.user_id),
      playerId: Number(b.player_id),
      playerName: `${b.fname} ${b.lname}`.trim(),
      clubName: b.club_name,
      amount: Number(b.amount),
      status: b.status,
      playerOutId: b.player_out_id ? Number(b.player_out_id) : null,
      playerOutName: b.player_out_id ? (playerOutMap.get(Number(b.player_out_id)) ?? null) : null,
    })),
    participants: participantData,
  });
}

// POST: admin actions for winter mercato
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const { action, leagueId } = await request.json() as {
      action: "create" | "open" | "close-round" | "resolve-round" | "resolve-tiebreak" | "close-auction";
      leagueId: number;
    };

    if (action === "create") {
      // Create winter auction with per-user budgets

      // Check no existing active winter auction
      const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
        "SELECT id FROM AUCTION WHERE league_id = ? AND type = 'winter' AND status != 'resolved' LIMIT 1",
        leagueId
      );
      if (existing.length > 0) {
        return NextResponse.json({ error: "Un mercato d'hiver est deja en cours" }, { status: 400 });
      }

      // Get standings for budget calculation
      const currentDay = (await prisma.score.findFirst({ orderBy: { day: "desc" } }))?.day ?? 1;
      const allStats = await prisma.$queryRawUnsafe<{ userId: number; total: number }[]>(
        `SELECT ID_USER as userId, SUM(PTS_TOT) as total
         FROM STATS_USER WHERE ID_LEAGUE = ? AND DAY <= ?
         GROUP BY ID_USER ORDER BY total DESC`,
        leagueId, currentDay
      );

      // Create the auction (players_per_user=0 for winter — no fixed quota)
      await prisma.$executeRawUnsafe(
        "INSERT INTO AUCTION (league_id, status, current_round, budget_per_user, players_per_user, type) VALUES (?, 'open', 1, 0, 0, 'winter')",
        leagueId
      );

      // Get the created auction ID
      const [newAuction] = await prisma.$queryRawUnsafe<{ id: number }[]>(
        "SELECT id FROM AUCTION WHERE league_id = ? AND type = 'winter' ORDER BY id DESC LIMIT 1",
        leagueId
      );
      const auctionId = Number(newAuction.id);

      // Create AUCTION_BUDGET entries for each user
      for (let i = 0; i < allStats.length; i++) {
        const rank = i + 1;
        const budget = 10 + (rank - 1) * 2;
        await prisma.$executeRawUnsafe(
          "INSERT INTO AUCTION_BUDGET (auction_id, user_id, budget) VALUES (?, ?, ?)",
          auctionId, Number(allStats[i].userId), budget
        );
      }

      return NextResponse.json({ ok: true, message: "Mercato d'hiver ouvert (tour 1)" });
    }

    if (action === "open") {
      // Open next round of existing winter auction
      const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
        "SELECT id FROM AUCTION WHERE league_id = ? AND type = 'winter' AND status != 'resolved' ORDER BY id DESC LIMIT 1",
        leagueId
      );
      if (existing.length === 0) {
        return NextResponse.json({ error: "Pas de mercato d'hiver actif" }, { status: 400 });
      }
      await prisma.$executeRawUnsafe(
        "UPDATE AUCTION SET status = 'open', current_round = current_round + 1 WHERE id = ?",
        existing[0].id
      );
      return NextResponse.json({ ok: true, message: "Tour suivant ouvert" });
    }

    if (action === "close-round") {
      await prisma.$executeRawUnsafe(
        "UPDATE AUCTION SET status = 'closed' WHERE league_id = ? AND type = 'winter' AND status = 'open'",
        leagueId
      );
      return NextResponse.json({ ok: true, message: "Tour ferme aux encheres" });
    }

    if (action === "resolve-round") {
      const auction = await prisma.$queryRawUnsafe<{ id: number; current_round: number }[]>(
        "SELECT id, current_round FROM AUCTION WHERE league_id = ? AND type = 'winter' ORDER BY id DESC LIMIT 1",
        leagueId
      );
      if (auction.length === 0) return NextResponse.json({ error: "Pas de mercato" }, { status: 400 });

      const aId = Number(auction[0].id);
      const round = Number(auction[0].current_round);

      const bids = await prisma.$queryRawUnsafe<{
        id: number; user_id: number; player_id: number; amount: number;
      }[]>(
        "SELECT id, user_id, player_id, amount FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND status = 'pending' ORDER BY player_id, amount DESC",
        aId, round
      );

      const byPlayer = new Map<number, typeof bids>();
      bids.forEach((b) => {
        const arr = byPlayer.get(Number(b.player_id)) ?? [];
        arr.push(b);
        byPlayer.set(Number(b.player_id), arr);
      });

      let wonCount = 0, lostCount = 0, tiedCount = 0;

      for (const [, playerBids] of Array.from(byPlayer.entries())) {
        const sorted = playerBids.sort((a, b) => Number(b.amount) - Number(a.amount));
        const highest = Number(sorted[0].amount);
        const topBids = sorted.filter((b) => Number(b.amount) === highest);

        if (topBids.length === 1) {
          await prisma.$executeRawUnsafe(
            "UPDATE AUCTION_BID SET status = 'won' WHERE id = ?", Number(topBids[0].id)
          );
          wonCount++;
          for (const b of sorted.slice(1)) {
            await prisma.$executeRawUnsafe(
              "UPDATE AUCTION_BID SET status = 'lost' WHERE id = ?", Number(b.id)
            );
            lostCount++;
          }
        } else {
          for (const b of topBids) {
            await prisma.$executeRawUnsafe(
              "UPDATE AUCTION_BID SET status = 'tie' WHERE id = ?", Number(b.id)
            );
            tiedCount++;
          }
          for (const b of sorted.slice(topBids.length)) {
            await prisma.$executeRawUnsafe(
              "UPDATE AUCTION_BID SET status = 'lost' WHERE id = ?", Number(b.id)
            );
            lostCount++;
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
        message: `Tour ${round} resolu : ${wonCount} joueurs attribues, ${tiedCount} egalites, ${lostCount} encheres perdues`,
      });
    }

    if (action === "resolve-tiebreak") {
      const auction = await prisma.$queryRawUnsafe<{ id: number; current_round: number }[]>(
        "SELECT id, current_round FROM AUCTION WHERE league_id = ? AND type = 'winter' ORDER BY id DESC LIMIT 1",
        leagueId
      );
      if (auction.length === 0) return NextResponse.json({ error: "Pas de mercato" }, { status: 400 });

      const aId = Number(auction[0].id);
      const round = Number(auction[0].current_round);

      const ties = await prisma.$queryRawUnsafe<{
        id: number; user_id: number; player_id: number; amount: number;
      }[]>(
        "SELECT id, user_id, player_id, amount FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND status = 'tie'",
        aId, round
      );

      const tiesByPlayer = new Map<number, typeof ties>();
      ties.forEach((b) => {
        const arr = tiesByPlayer.get(Number(b.player_id)) ?? [];
        arr.push(b);
        tiesByPlayer.set(Number(b.player_id), arr);
      });

      let resolved = 0;
      for (const [, playerTies] of Array.from(tiesByPlayer.entries())) {
        const winnerIdx = Math.floor(Math.random() * playerTies.length);
        for (let i = 0; i < playerTies.length; i++) {
          const status = i === winnerIdx ? "won" : "lost";
          await prisma.$executeRawUnsafe(
            "UPDATE AUCTION_BID SET status = ? WHERE id = ?",
            status, Number(playerTies[i].id)
          );
        }
        resolved++;
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
        message: `${resolved} egalite(s) resolue(s) par tirage au sort`,
      });
    }

    if (action === "close-auction") {
      await prisma.$executeRawUnsafe(
        "UPDATE AUCTION SET status = 'resolved' WHERE league_id = ? AND type = 'winter' AND status != 'resolved'",
        leagueId
      );
      return NextResponse.json({ ok: true, message: "Mercato d'hiver termine" });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e) {
    return jsonError500("[mercato-hiver]", e, "Échec de l'opération mercato d'hiver");
  }
}
