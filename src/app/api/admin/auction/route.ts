import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma, inParams } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { isDeadlinePassed } from "@/lib/auction-deadline";
import { getCurrentSeason, getSeasonFilters } from "@/lib/season";
import { isNamedGoalkeeper } from "@/lib/club-goalkeeper";
import { canCompleteWith, type EnginePlayer } from "@/lib/auction-engine";
import { validateSummerBids, type SummerBid } from "@/lib/auction-validation";
import {
  planResolution,
  computeRosterStatuses,
  proposeCompletions,
  planTeamRows,
  lineFromPosition,
  type ResolutionPlayer,
} from "@/lib/auction-resolution";

// Cycle de vie d'un tour (statuts AUCTION) :
//   open    → tour ouvert aux soumissions
//   closed  → tour clôturé (soumissions verrouillées), prêt à dépouiller
//   tallied → tour dépouillé (moteur appliqué) ; l'admin ouvre le tour
//             suivant (open, round+1) OU clôt la phase
//   resolved → phase close (terminal) : effectifs écrits dans TEAM
//
// Le tirage au sort des égalités a été retiré le 2026-06-10 : il ne figure
// pas au règlement (égalité = personne, règle 3.2.a ; complétion d'office à
// 1 pt en fin de phase, règle 4). Cf docs/regles-encheres.md section 7.
// Aucune action resolve-tiebreak n'existe dans cette API ni dans l'UI admin.

// Charge la dernière enchère d'été d'une ligue.
async function getSummerAuction(leagueId: number) {
  const rows = await prisma.$queryRawUnsafe<{
    id: number; league_id: number; status: string; current_round: number;
    budget_per_user: number; players_per_user: number; round_deadline: Date | null;
  }[]>(
    "SELECT id, league_id, status, current_round, budget_per_user, players_per_user, round_deadline FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' ORDER BY id DESC LIMIT 1",
    leagueId
  );
  if (rows.length === 0) return null;
  return {
    id: Number(rows[0].id),
    leagueId: Number(rows[0].league_id),
    status: rows[0].status,
    currentRound: Number(rows[0].current_round),
    budgetPerUser: Number(rows[0].budget_per_user),
    playersPerUser: Number(rows[0].players_per_user),
    roundDeadline: rows[0].round_deadline ? new Date(rows[0].round_deadline) : null,
  };
}

// Joueurs (id → projection moteur) pour un ensemble d'ids.
async function loadPlayers(playerIds: number[]): Promise<Map<number, ResolutionPlayer>> {
  if (playerIds.length === 0) return new Map();
  const [ph, vs] = inParams(Array.from(new Set(playerIds)));
  const rows = await prisma.$queryRawUnsafe<{
    id: number; fname: string; lname: string; position: string;
  }[]>(
    `SELECT ID_PLAYER as id, FNAME as fname, LNAME as lname, POSITION as position FROM PLAYER WHERE ID_PLAYER IN (${ph})`,
    ...vs
  );
  return new Map(
    rows.map((r) => [
      Number(r.id),
      {
        id: Number(r.id),
        lastName: r.lname,
        position: r.position,
        displayName: `${r.fname} ${r.lname}`.trim(),
      },
    ])
  );
}

// Mises won (tous tours) et pending (tour courant) d'une enchère.
async function loadWonBids(auctionId: number) {
  const rows = await prisma.$queryRawUnsafe<{ user_id: number; player_id: number; amount: number }[]>(
    "SELECT user_id, player_id, amount FROM AUCTION_BID WHERE auction_id = ? AND status = 'won'",
    auctionId
  );
  return rows.map((r) => ({
    userId: Number(r.user_id),
    playerId: Number(r.player_id),
    amount: Number(r.amount),
  }));
}

async function loadParticipantIds(leagueId: number): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<{ userId: number }[]>(
    "SELECT lu.ID_USER as userId FROM LEAGUE_USER lu WHERE lu.ID_LEAGUE = ?",
    leagueId
  );
  return rows.map((r) => Number(r.userId));
}

// GET: état complet de la console enchères d'une ligue
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 0);

  const season = await getCurrentSeason();
  const seasonLabel = season?.label ?? null;

  const auction = await getSummerAuction(leagueId);
  if (!auction) {
    return NextResponse.json({ auction: null, seasonLabel });
  }

  // Bids du tour courant (tous statuts) pour le tableau admin
  const bids = await prisma.$queryRawUnsafe<{
    user_id: number; player_id: number; amount: number; status: string;
    fname: string; lname: string; club_name: string; position: string;
  }[]>(
    `SELECT b.user_id, b.player_id, b.amount, b.status, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name, p.POSITION as position
     FROM AUCTION_BID b
     JOIN PLAYER p ON b.player_id = p.ID_PLAYER
     JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.round = ?
     ORDER BY b.amount DESC`,
    auction.id, auction.currentRound
  );

  // Participants + budgets (seules les mises won décomptent : restitution 3.2.b)
  const participants = await prisma.$queryRawUnsafe<{ userId: number; userName: string }[]>(
    `SELECT lu.ID_USER as userId, u.NAME as userName
     FROM LEAGUE_USER lu JOIN USER u ON lu.ID_USER = u.ID_USER
     WHERE lu.ID_LEAGUE = ?`,
    leagueId
  );

  const wonBids = await loadWonBids(auction.id);
  const spentMap = new Map<number, number>();
  const wonCountMap = new Map<number, number>();
  for (const w of wonBids) {
    spentMap.set(w.userId, (spentMap.get(w.userId) ?? 0) + w.amount);
    wonCountMap.set(w.userId, (wonCountMap.get(w.userId) ?? 0) + 1);
  }

  // Soumissions du tour courant (au moins une mise, quel que soit le statut)
  const submittedRows = await prisma.$queryRawUnsafe<{ user_id: number }[]>(
    "SELECT DISTINCT user_id FROM AUCTION_BID WHERE auction_id = ? AND round = ?",
    auction.id, auction.currentRound
  );
  const submittedSet = new Set(submittedRows.map((r) => Number(r.user_id)));

  // États d'effectif (validité règle 2.1) — calculés via le moteur
  const playersMap = await loadPlayers(wonBids.map((w) => w.playerId));
  const rosterStatuses = computeRosterStatuses({
    participantIds: participants.map((p) => Number(p.userId)),
    players: playersMap,
    wonBids,
  });
  const rosterByUser = new Map(rosterStatuses.map((r) => [r.userId, r]));

  // Phase close = effectifs écrits dans TEAM pour cette ligue
  const teamCountRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    "SELECT COUNT(*) as cnt FROM TEAM WHERE ID_LEAGUE = ? AND DAY_FIRST = 1",
    leagueId
  );
  const phaseClosed = Number(teamCountRows[0]?.cnt ?? 0) > 0 && auction.status === "resolved";

  // Résultats du dépouillement du tour courant (statuts tallied/resolved)
  let results: {
    removals: { userId: number; playerId: number; playerName: string; amount: number; reason: string }[];
    ties: { playerId: number; playerName: string; amount: number; userIds: number[] }[];
  } | null = null;
  if (auction.status === "tallied" || auction.status === "resolved") {
    const removalRows = await prisma.$queryRawUnsafe<{
      user_id: number; player_id: number; amount: number; reason: string; fname: string; lname: string;
    }[]>(
      `SELECT r.user_id, r.player_id, r.amount, r.reason, p.FNAME as fname, p.LNAME as lname
       FROM AUCTION_REMOVAL r JOIN PLAYER p ON r.player_id = p.ID_PLAYER
       WHERE r.auction_id = ? AND r.round = ?
       ORDER BY r.id`,
      auction.id, auction.currentRound
    );
    const tieMap = new Map<number, { playerName: string; amount: number; userIds: number[] }>();
    for (const b of bids) {
      if (b.status !== "tie") continue;
      const pid = Number(b.player_id);
      const entry = tieMap.get(pid) ?? {
        playerName: `${b.fname} ${b.lname}`.trim(),
        amount: Number(b.amount),
        userIds: [],
      };
      entry.userIds.push(Number(b.user_id));
      tieMap.set(pid, entry);
    }
    results = {
      removals: removalRows.map((r) => ({
        userId: Number(r.user_id),
        playerId: Number(r.player_id),
        playerName: `${r.fname} ${r.lname}`.trim(),
        amount: Number(r.amount),
        reason: r.reason,
      })),
      ties: Array.from(tieMap.entries()).map(([playerId, t]) => ({ playerId, ...t })),
    };
  }

  // Complétion d'office (statut tallied uniquement) : joueurs disponibles
  // proposés pour les effectifs incomplets, validés par le moteur.
  const incomplete = rosterStatuses.filter((r) => r.missingCount > 0 || r.errors.length > 0);
  let proposalsByUser = new Map<number, { playerId: number; name: string; line: string }[]>();
  if (auction.status === "tallied" && incomplete.some((r) => r.missingCount > 0)) {
    const seasonFilters = await getSeasonFilters();
    const seasonClause = "seasonId" in seasonFilters.player
      ? `AND p.ID_SEASON = ${Number((seasonFilters.player as { seasonId: number }).seasonId)}`
      : "";
    const takenIds = new Set(wonBids.map((w) => w.playerId));
    const availableRows = await prisma.$queryRawUnsafe<{
      id: number; fname: string; lname: string; position: string; link: string | null;
    }[]>(
      `SELECT p.ID_PLAYER as id, p.FNAME as fname, p.LNAME as lname, p.POSITION as position, p.LINK as link
       FROM PLAYER p WHERE 1=1 ${seasonClause} ORDER BY p.LNAME, p.FNAME`
    );
    const available: (EnginePlayer & { displayName: string })[] = availableRows
      .filter((p) => !takenIds.has(Number(p.id)))
      .filter((p) => !isNamedGoalkeeper({ position: p.position, link: p.link }))
      .map((p) => ({
        id: Number(p.id),
        lastName: p.lname,
        line: lineFromPosition(p.position),
        displayName: `${p.fname} ${p.lname}`.trim(),
      }));
    const nameById = new Map(available.map((p) => [p.id, p.displayName]));
    proposalsByUser = new Map(
      incomplete
        .filter((r) => r.missingCount > 0)
        .map((r) => [
          r.userId,
          proposeCompletions(r.roster, available).map((p) => ({
            playerId: p.id,
            name: nameById.get(p.id) ?? p.lastName,
            line: p.line,
          })),
        ])
    );
  }

  const participantData = participants.map((p) => {
    const userId = Number(p.userId);
    const roster = rosterByUser.get(userId);
    return {
      userId,
      userName: (p.userName ?? "").replace(/<[^>]*>/g, "").trim(),
      budget: auction.budgetPerUser - (spentMap.get(userId) ?? 0),
      playersWon: wonCountMap.get(userId) ?? 0,
      playersNeeded: auction.playersPerUser - (wonCountMap.get(userId) ?? 0),
      hasSubmitted: submittedSet.has(userId),
      rosterValid: (roster?.errors.length ?? 1) === 0,
      rosterErrors: roster?.errors ?? [],
      missingCount: roster?.missingCount ?? auction.playersPerUser,
      missingLines: roster?.missingLines ?? "",
      proposals: proposalsByUser.get(userId) ?? [],
    };
  });

  // M1 : Toutes les acquisitions de tous les tours (pour récap cumulé par participant).
  // Seules les mises status='won' comptent ; on joint joueur+club pour position et nom de club.
  const allWonBidsRows = await prisma.$queryRawUnsafe<{
    user_id: number; player_id: number; amount: number; round: number;
    fname: string; lname: string; club_name: string; position: string;
  }[]>(
    `SELECT b.user_id, b.player_id, b.amount, b.round, p.FNAME as fname, p.LNAME as lname, c.NAME as club_name, p.POSITION as position
     FROM AUCTION_BID b
     JOIN PLAYER p ON b.player_id = p.ID_PLAYER
     JOIN CLUB c ON p.ID_CLUB = c.ID_CLUB
     WHERE b.auction_id = ? AND b.status = 'won'
     ORDER BY b.round, b.amount DESC`,
    auction.id
  );

  return NextResponse.json({
    seasonLabel,
    auction: {
      id: auction.id,
      leagueId: auction.leagueId,
      status: auction.status,
      currentRound: auction.currentRound,
      budget: auction.budgetPerUser,
      playersPerUser: auction.playersPerUser,
      roundDeadline: auction.roundDeadline ? auction.roundDeadline.toISOString() : null,
      phaseClosed,
    },
    bids: bids.map((b) => ({
      userId: Number(b.user_id),
      playerId: Number(b.player_id),
      playerName: `${b.fname} ${b.lname}`.trim(),
      clubName: b.club_name,
      position: b.position,
      amount: Number(b.amount),
      status: b.status,
    })),
    // M1 : Acquisitions de tous les tours dépouillés (récap cumulé)
    allWonBids: allWonBidsRows.map((b) => ({
      userId: Number(b.user_id),
      playerId: Number(b.player_id),
      playerName: `${b.fname} ${b.lname}`.trim(),
      clubName: b.club_name,
      position: b.position,
      amount: Number(b.amount),
      round: Number(b.round),
    })),
    participants: participantData,
    results,
  });
}

// POST: actions admin (open, set-deadline, close-round, resolve-round,
// complete-roster, close-phase)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {

    const { action, leagueId, deadline, userId, playerIds, bids, adminUserId } = await request.json() as {
      action: "open" | "close-round" | "resolve-round" | "complete-roster" | "close-phase" | "set-deadline" | "enter-bid-for-user";
      leagueId: number;
      deadline?: string | null; // ISO 8601 ou null pour effacer
      userId?: number; // complete-roster | enter-bid-for-user (participant cible)
      playerIds?: number[]; // complete-roster
      bids?: SummerBid[]; // enter-bid-for-user
      adminUserId?: number; // enter-bid-for-user : indicatif. La source de vérité
                            // de l'audit est la session admin (auth.session), pas
                            // ce champ client (non falsifiable côté serveur).
    };

    if (action === "open") {
      // Garde-fou : jamais d'enchère sur une ligue d'une saison clôturée
      // (pendant la préparation, aucune saison n'est courante et la liste des
      // ligues contient encore les divisions de la saison passée).
      const league = await prisma.league.findUnique({
        where: { id: leagueId },
        include: { season: { select: { status: true, label: true } } },
      });
      if (!league) {
        return NextResponse.json({ error: "Ligue introuvable" }, { status: 404 });
      }
      if (league.season?.status === "CLOSED") {
        return NextResponse.json(
          {
            error: `Cette ligue appartient à la saison clôturée ${league.season.label} — sélectionne une division de la nouvelle saison.`,
          },
          { status: 409 }
        );
      }

      // Valider la deadline si fournie
      const deadlineDate = deadline ? new Date(deadline) : null;
      if (deadlineDate !== null && isNaN(deadlineDate.getTime())) {
        return NextResponse.json({ error: "Date butoir invalide" }, { status: 400 });
      }
      // Garde-fou : refuser une deadline déjà passée (toutes les mises seraient rejetées immédiatement)
      if (isDeadlinePassed(deadlineDate, new Date())) {
        return NextResponse.json({ error: "La date butoir est déjà passée — choisissez une date dans le futur." }, { status: 400 });
      }

      // M2 : Garde d'état — on ne peut ouvrir un nouveau tour que si :
      //   (a) aucune enchère active n'existe, OU
      //   (b) l'enchère existante est au statut 'tallied' (dernier tour dépouillé).
      // Un open rejoué sur une enchère 'open' ou 'closed' → 409.
      const activeAuction = await prisma.$queryRawUnsafe<{ id: number; status: string }[]>(
        "SELECT id, status FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' AND status != 'resolved' ORDER BY id DESC LIMIT 1",
        leagueId
      );

      if (activeAuction.length > 0) {
        const currentStatus = activeAuction[0].status;
        if (currentStatus === "open" || currentStatus === "closed") {
          return NextResponse.json(
            { error: `Impossible d'ouvrir un nouveau tour : l'enchère est en statut '${currentStatus}'. Clôturez et dépouiller le tour en cours d'abord.` },
            { status: 409 }
          );
        }
        // statut 'tallied' : on peut ouvrir le tour suivant
        if (deadlineDate !== null) {
          await prisma.$executeRawUnsafe(
            "UPDATE AUCTION SET status = 'open', current_round = current_round + 1, round_deadline = ? WHERE id = ?",
            deadlineDate, activeAuction[0].id
          );
        } else {
          await prisma.$executeRawUnsafe(
            "UPDATE AUCTION SET status = 'open', current_round = current_round + 1, round_deadline = NULL WHERE id = ?",
            activeAuction[0].id
          );
        }
        return NextResponse.json({ ok: true, message: "Tour suivant ouvert" });
      }

      // Create new auction
      if (deadlineDate !== null) {
        await prisma.$executeRawUnsafe(
          "INSERT INTO AUCTION (league_id, status, current_round, round_deadline) VALUES (?, 'open', 1, ?)",
          leagueId, deadlineDate
        );
      } else {
        await prisma.$executeRawUnsafe(
          "INSERT INTO AUCTION (league_id, status, current_round) VALUES (?, 'open', 1)",
          leagueId
        );
      }
      return NextResponse.json({ ok: true, message: "Enchère ouverte (tour 1)" });
    }

    if (action === "set-deadline") {
      // Modifier la deadline d'un tour ouvert
      const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
        "SELECT id FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' AND status = 'open' ORDER BY id DESC LIMIT 1",
        leagueId
      );
      if (existing.length === 0) {
        return NextResponse.json({ error: "Pas de tour ouvert pour cette ligue" }, { status: 400 });
      }
      if (deadline === undefined) {
        return NextResponse.json({ error: "Champ deadline manquant" }, { status: 400 });
      }
      const deadlineDate = deadline ? new Date(deadline) : null;
      if (deadlineDate !== null && isNaN(deadlineDate.getTime())) {
        return NextResponse.json({ error: "Date butoir invalide" }, { status: 400 });
      }
      // Garde-fou : refuser une deadline déjà passée (toutes les mises seraient rejetées immédiatement)
      if (isDeadlinePassed(deadlineDate, new Date())) {
        return NextResponse.json({ error: "La date butoir est déjà passée — choisissez une date dans le futur." }, { status: 400 });
      }
      if (deadlineDate !== null) {
        await prisma.$executeRawUnsafe(
          "UPDATE AUCTION SET round_deadline = ? WHERE id = ?",
          deadlineDate, existing[0].id
        );
      } else {
        await prisma.$executeRawUnsafe(
          "UPDATE AUCTION SET round_deadline = NULL WHERE id = ?",
          existing[0].id
        );
      }
      return NextResponse.json({ ok: true, message: deadline ? "Heure butoir enregistrée" : "Heure butoir effacée" });
    }

    if (action === "close-round") {
      // Close bidding for current round
      const updated = await prisma.$executeRawUnsafe(
        "UPDATE AUCTION SET status = 'closed' WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' AND status = 'open'",
        leagueId
      );
      if (updated === 0) {
        return NextResponse.json({ error: "Pas de tour ouvert pour cette ligue" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "Tour clôturé aux enchères" });
    }

    if (action === "resolve-round") {
      // Dépouillement : AUCUN calcul de règle ici, tout vient du moteur
      // (src/lib/auction-engine.ts) via la couche pure auction-resolution.ts.
      const auction = await getSummerAuction(leagueId);
      if (!auction) return NextResponse.json({ error: "Pas d'enchère" }, { status: 400 });
      if (auction.status !== "closed") {
        return NextResponse.json({ error: "Le tour doit être clôturé avant le dépouillement" }, { status: 400 });
      }

      const pendingRows = await prisma.$queryRawUnsafe<{
        id: number; user_id: number; player_id: number; amount: number;
      }[]>(
        "SELECT id, user_id, player_id, amount FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND status = 'pending'",
        auction.id, auction.currentRound
      );
      const pendingBids = pendingRows.map((b) => ({
        id: Number(b.id),
        userId: Number(b.user_id),
        playerId: Number(b.player_id),
        amount: Number(b.amount),
      }));

      const wonBids = await loadWonBids(auction.id);
      const participantIds = await loadParticipantIds(leagueId);
      const players = await loadPlayers([
        ...pendingBids.map((b) => b.playerId),
        ...wonBids.map((w) => w.playerId),
      ]);

      let plan: ReturnType<typeof planResolution>;
      try {
        plan = planResolution({
          budgetPerUser: auction.budgetPerUser,
          participantIds,
          players,
          wonBids,
          pendingBids,
        });
      } catch (e) {
        return NextResponse.json(
          { error: `Dépouillement refusé : ${e instanceof Error ? e.message : "état incohérent"}` },
          { status: 409 }
        );
      }

      // M1 : Anti-double-dépouillement.
      // L'UPDATE conditionnel (WHERE status='closed') est placé EN PREMIER dans la
      // transaction pour prendre le verrou immédiatement. Si affectedRows = 0,
      // le tour a déjà été dépouillé par un appel concurrent → 409 sans écriture.
      // Prisma.$transaction est séquentiel (pas de SAVEPOINT InnoDB) donc l'UPDATE
      // est exécuté avant les INSERT AUCTION_BID / AUCTION_REMOVAL.
      const lockResult = await prisma.$executeRawUnsafe(
        "UPDATE AUCTION SET status = 'tallied' WHERE id = ? AND status = 'closed'",
        auction.id
      );
      if (lockResult === 0) {
        return NextResponse.json(
          { error: "Ce tour a déjà été dépouillé (statut ≠ 'closed')" },
          { status: 409 }
        );
      }

      // Écritures des statuts de mises et des retraits motivés (verrou déjà posé ci-dessus).
      await prisma.$transaction([
        ...plan.updates.map((u) =>
          prisma.$executeRawUnsafe("UPDATE AUCTION_BID SET status = ? WHERE id = ?", u.status, u.bidId)
        ),
        ...plan.removals.map((r) =>
          prisma.$executeRawUnsafe(
            "INSERT INTO AUCTION_REMOVAL (auction_id, round, user_id, player_id, amount, reason) VALUES (?, ?, ?, ?, ?, ?)",
            auction.id, auction.currentRound, r.userId, r.playerId, r.amount, r.reason
          )
        ),
      ]);

      const won = plan.updates.filter((u) => u.status === "won").length;
      const lost = plan.updates.filter((u) => u.status === "lost").length;
      const tied = plan.outcome.ties.length;
      const removed = plan.removals.length;
      return NextResponse.json({
        ok: true,
        message: `Tour ${auction.currentRound} dépouillé : ${won} joueurs attribués, ${tied} égalité(s) remise(s) en jeu, ${lost} mises perdues, ${removed} retrait(s) de pénalité`,
      });
    }

    if (action === "complete-roster") {
      // Complétion d'office à 1 pt (règle 4) pour UN participant incomplet.
      if (!userId || !playerIds || playerIds.length === 0) {
        return NextResponse.json({ error: "userId et playerIds requis" }, { status: 400 });
      }
      const auction = await getSummerAuction(leagueId);
      if (!auction) return NextResponse.json({ error: "Pas d'enchère" }, { status: 400 });
      if (auction.status !== "tallied") {
        return NextResponse.json({ error: "La complétion d'office se fait après dépouillement, avant la clôture de phase" }, { status: 400 });
      }

      // m3 : Dédoublonnage des playerIds fournis
      const uniquePlayerIds = Array.from(new Set(playerIds));

      // m5 : Vérifier que userId appartient bien à la ligue
      const memberRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        "SELECT COUNT(*) as cnt FROM LEAGUE_USER WHERE ID_LEAGUE = ? AND ID_USER = ?",
        leagueId, userId
      );
      if (Number(memberRows[0]?.cnt ?? 0) === 0) {
        return NextResponse.json({ error: `L'utilisateur #${userId} ne fait pas partie de cette ligue` }, { status: 400 });
      }

      const wonBids = await loadWonBids(auction.id);
      const takenIds = new Set(wonBids.map((w) => w.playerId));
      for (const pid of uniquePlayerIds) {
        if (takenIds.has(pid)) {
          return NextResponse.json({ error: `Joueur #${pid} déjà attribué dans cette enchère` }, { status: 400 });
        }
      }

      const players = await loadPlayers([
        ...wonBids.filter((w) => w.userId === userId).map((w) => w.playerId),
        ...uniquePlayerIds,
      ]);

      // Gardiens nommés interdits (règle 2.1 : gardien = pseudo-joueur par club)
      // m5 : Scope les joueurs candidats à la saison courante
      const seasonFilters = await getSeasonFilters();
      const seasonClause = "seasonId" in seasonFilters.player
        ? `AND p.ID_SEASON = ${Number((seasonFilters.player as { seasonId: number }).seasonId)}`
        : "";
      const [ph, vs] = inParams(uniquePlayerIds);
      const candidateRows = await prisma.$queryRawUnsafe<{ id: number; position: string; link: string | null }[]>(
        `SELECT ID_PLAYER as id, POSITION as position, LINK as link FROM PLAYER p WHERE ID_PLAYER IN (${ph}) ${seasonClause}`,
        ...vs
      );
      if (candidateRows.length !== uniquePlayerIds.length) {
        return NextResponse.json({ error: "Joueur inexistant ou n'appartenant pas à la saison courante" }, { status: 400 });
      }
      for (const c of candidateRows) {
        if (isNamedGoalkeeper({ position: c.position, link: c.link })) {
          return NextResponse.json(
            { error: `Joueur #${c.id} est un gardien nommé : utilisez le pseudo-joueur « Gardiens [Club] »` },
            { status: 400 }
          );
        }
      }

      // Validation des quotas par le moteur, ajout par ajout
      const roster: EnginePlayer[] = wonBids
        .filter((w) => w.userId === userId)
        .map((w) => {
          const p = players.get(w.playerId);
          return { id: w.playerId, lastName: p?.lastName ?? "", line: lineFromPosition(p?.position ?? "") };
        });
      for (const pid of uniquePlayerIds) {
        const p = players.get(pid);
        const candidate: EnginePlayer = { id: pid, lastName: p?.lastName ?? "", line: lineFromPosition(p?.position ?? "") };
        const check = canCompleteWith(roster, candidate);
        if (!check.ok) {
          return NextResponse.json(
            { error: `Ajout refusé pour ${p?.displayName ?? `#${pid}`} : ${check.reason}` },
            { status: 400 }
          );
        }
        roster.push(candidate);
      }

      // m5 : Vérification que l'effectif final respecte la taille players_per_user
      // (remplace le 13 codé en dur là où c'est trivial : ici la taille attendue est
      // disponible via auction.playersPerUser)
      if (roster.length > auction.playersPerUser) {
        return NextResponse.json(
          { error: `La complétion dépasse le plafond de ${auction.playersPerUser} joueurs par participant` },
          { status: 400 }
        );
      }

      // Acquisitions d'office à 1 pt, persistées comme mises gagnées du tour courant
      await prisma.$transaction(
        uniquePlayerIds.map((pid) =>
          prisma.$executeRawUnsafe(
            "INSERT INTO AUCTION_BID (auction_id, round, user_id, player_id, amount, status) VALUES (?, ?, ?, ?, 1, 'won')",
            auction.id, auction.currentRound, userId, pid
          )
        )
      );
      return NextResponse.json({
        ok: true,
        message: `${uniquePlayerIds.length} joueur(s) ajouté(s) d'office à 1 pt`,
      });
    }

    if (action === "close-phase") {
      // Clore la phase (règle 4) : tous les effectifs doivent être valides
      // (13 joueurs, quotas règle 2.1 — validation par le moteur), puis les
      // effectifs sont écrits dans TEAM pour la saison (pont vers le scoring,
      // même chemin d'écriture que les jokers).
      const auction = await getSummerAuction(leagueId);
      if (!auction) return NextResponse.json({ error: "Pas d'enchère" }, { status: 400 });
      if (auction.status !== "tallied") {
        return NextResponse.json({ error: "La phase se clôt après le dépouillement du dernier tour" }, { status: 400 });
      }

      const wonBids = await loadWonBids(auction.id);
      const participantIds = await loadParticipantIds(leagueId);
      const players = await loadPlayers(wonBids.map((w) => w.playerId));
      const statuses = computeRosterStatuses({ participantIds, players, wonBids });

      const invalid = statuses.filter((s) => s.errors.length > 0);
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error: `${invalid.length} effectif(s) invalide(s) — complétez d'office avant de clore la phase`,
            incomplete: invalid.map((s) => ({ userId: s.userId, errors: s.errors })),
          },
          { status: 400 }
        );
      }

      // B2 : Logique de reprise pour close-phase avec TEAM en MyISAM.
      // MyISAM ne supporte pas les rollbacks transactionnels : un échec à mi-INSERT
      // laisse des lignes partielles dans TEAM. Dans ce cas la garde "TEAM non vide"
      // renverrait 409 pour toujours, bloquant la reprise.
      //
      // Note : ici auction.status est forcément 'tallied' (vérification ci-dessus).
      // Le 409 "phase déjà close" (statut 'resolved') est attrapé avant par
      // getSummerAuction qui filtre status != 'resolved', combiné à la garde
      // status !== 'tallied'. On ne peut donc jamais arriver ici avec 'resolved'.
      //
      // Sémantique :
      //   - TEAM non vide ET statut 'tallied' → état partiel d'une tentative échouée
      //                                          → PURGE des lignes scoped à la ligue
      //                                          → ré-insertion propre
      //   - TEAM vide                          → premier appel normal
      const teamCountRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        "SELECT COUNT(*) as cnt FROM TEAM WHERE ID_LEAGUE = ? AND DAY_FIRST = 1",
        leagueId
      );
      const existingTeamRows = Number(teamCountRows[0]?.cnt ?? 0);

      if (existingTeamRows > 0) {
        // Statut 'tallied' avec lignes TEAM existantes : état partiel issu d'une
        // tentative précédente qui a échoué en cours d'INSERT (MyISAM, pas de rollback).
        // On purge les lignes scoped à cette ligue pour repartir proprement.
        await prisma.$executeRawUnsafe(
          "DELETE FROM TEAM WHERE ID_LEAGUE = ? AND DAY_FIRST = 1",
          leagueId
        );
      }

      let teamRows;
      try {
        teamRows = planTeamRows(
          leagueId,
          statuses.map((s) => ({ userId: s.userId, roster: s.roster }))
        );
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Effectif invalide" },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        ...teamRows.map((t) =>
          prisma.$executeRawUnsafe(
            "INSERT INTO TEAM (ID_LEAGUE, ID_USER, ID_PLAYER, DAY_FIRST, DAY_LAST, IS_SUBS) VALUES (?, ?, ?, ?, ?, ?)",
            t.leagueId, t.userId, t.playerId, t.dayFirst, t.dayLast, t.isSubs
          )
        ),
        prisma.$executeRawUnsafe("UPDATE AUCTION SET status = 'resolved' WHERE id = ?", auction.id),
      ]);

      return NextResponse.json({
        ok: true,
        message: `Phase close : ${teamRows.length} joueurs écrits dans les effectifs (${statuses.length} participants × 13)`,
      });
    }

    if (action === "enter-bid-for-user") {
      // BRIEF-11 : saisie manuelle d'une mise AU NOM d'un participant (retardataire).
      // Réutilise EXACTEMENT la validation de la soumission participant
      // (validateSummerBids) : budget/quotas/gardien/joueurs déjà attribués sont
      // évalués à l'identique. SEULE différence avec /api/auction : aucune garde
      // deadline (le but est de contourner l'heure butoir pour rattraper un retard).
      if (!userId) {
        return NextResponse.json({ error: "userId (participant cible) requis" }, { status: 400 });
      }
      if (!bids || !Array.isArray(bids) || bids.length === 0) {
        return NextResponse.json({ error: "Au moins une mise (bids) est requise" }, { status: 400 });
      }

      const auction = await getSummerAuction(leagueId);
      if (!auction) return NextResponse.json({ error: "Pas d'enchère" }, { status: 400 });
      // Tour modifiable tant qu'il n'est pas dépouillé : 'open' ou 'closed'
      // (après 'tallied'/'resolved', les statuts de mises sont figés).
      if (auction.status !== "open" && auction.status !== "closed") {
        return NextResponse.json(
          { error: `La saisie manuelle n'est possible que sur un tour ouvert ou clôturé (statut actuel : '${auction.status}').` },
          { status: 400 }
        );
      }

      // Le participant cible doit appartenir à la ligue
      const memberRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        "SELECT COUNT(*) as cnt FROM LEAGUE_USER WHERE ID_LEAGUE = ? AND ID_USER = ?",
        leagueId, userId
      );
      if (Number(memberRows[0]?.cnt ?? 0) === 0) {
        return NextResponse.json({ error: `L'utilisateur #${userId} ne fait pas partie de cette ligue` }, { status: 400 });
      }

      // Validation PARTAGÉE (mêmes règles, mêmes erreurs que /api/auction).
      const validationError = await validateSummerBids(prisma, auction.id, userId, bids);
      if (validationError) {
        return NextResponse.json({ error: validationError.error }, { status: validationError.status });
      }

      // Remplace les mises 'pending' du participant pour ce tour (même sémantique
      // que la soumission participant), avec traçabilité admin_entered_by.
      await prisma.$executeRawUnsafe(
        "DELETE FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND user_id = ? AND status = 'pending'",
        auction.id, auction.currentRound, userId
      );
      // Audit : on enregistre l'admin de la SESSION (source fiable). Le champ
      // client adminUserId n'est qu'un repli indicatif s'il manque (jamais le cas
      // en pratique puisque requireAdmin() impose une session valide).
      const adminEnteredBy = auth.session.user.userId ?? adminUserId ?? null;
      for (const bid of bids) {
        await prisma.$executeRawUnsafe(
          "INSERT INTO AUCTION_BID (auction_id, round, user_id, player_id, amount, status, admin_entered_by) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
          auction.id, auction.currentRound, userId, bid.playerId, bid.amount, adminEnteredBy
        );
      }

      return NextResponse.json({
        ok: true,
        message: `${bids.length} mise(s) saisie(s) au nom du participant #${userId}`,
      });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e) {
    return jsonError500("[auction]", e, "Échec de l'opération enchères");
  }
}
