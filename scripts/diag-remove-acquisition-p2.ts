/**
 * Vérification runtime du retrait manuel d'une acquisition (handoff 2026-08-11)
 * sur la COPIE ligueenc_p2 (jamais sur la prod).
 *
 * Rejoue la transaction exacte de la route POST /api/admin/auction
 * action=remove-acquisition (UPDATE conditionnel puis INSERT AUCTION_REMOVAL)
 * sur une acquisition won du tour 1 de la ligue 39, puis contrôle :
 *   1. statut de la mise → 'removed', ligne AUCTION_REMOVAL avec reason tracé
 *   2. idempotence : rejouer l'UPDATE affecte 0 ligne (double-clic sans effet)
 *   3. budget recrédité : la somme des won du participant baisse du montant
 *   4. joueur re-misable : absent de l'ensemble takenIds (= won)
 * L'état de la copie est restauré à la fin (retrait annulé).
 *
 * Usage :
 *   DATABASE_URL="mysql://.../ligueenc_p2" ./node_modules/.bin/tsx scripts/diag-remove-acquisition-p2.ts
 */

import { prisma } from "../src/lib/prisma";
import { planManualRemoval } from "../src/lib/auction-manual-removal";

const LEAGUE_ID = 39;

function assert(cond: boolean, label: string) {
  console.log(`${cond ? "OK " : "ÉCHEC"} — ${label}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const dbRows = await prisma.$queryRawUnsafe<{ db: string }[]>("SELECT DATABASE() as db");
  const db = dbRows[0]?.db;
  if (db !== "ligueenc_p2") {
    throw new Error(`Ce script ne tourne QUE sur ligueenc_p2 (base courante : ${db})`);
  }

  const auctions = await prisma.$queryRawUnsafe<{ id: number; status: string; current_round: number }[]>(
    "SELECT id, status, current_round FROM AUCTION WHERE league_id = ? AND COALESCE(type,'summer')='summer' ORDER BY id DESC LIMIT 1",
    LEAGUE_ID
  );
  const auction = { id: Number(auctions[0].id), status: auctions[0].status };
  console.log(`Enchère ligue ${LEAGUE_ID} : id=${auction.id}, statut=${auction.status}`);

  const bids = await prisma.$queryRawUnsafe<{
    id: number; auction_id: number; round: number; user_id: number; player_id: number; amount: number; status: string;
  }[]>(
    "SELECT id, auction_id, round, user_id, player_id, amount, status FROM AUCTION_BID WHERE auction_id = ? AND status = 'won' ORDER BY id LIMIT 1",
    auction.id
  );
  if (bids.length === 0) throw new Error("Aucune acquisition won sur cette enchère");
  const bid = {
    id: Number(bids[0].id), auctionId: Number(bids[0].auction_id), round: Number(bids[0].round),
    userId: Number(bids[0].user_id), playerId: Number(bids[0].player_id),
    amount: Number(bids[0].amount), status: bids[0].status,
  };
  console.log(`Cible : bid ${bid.id} (user ${bid.userId}, player ${bid.playerId}, ${bid.amount} pts, tour ${bid.round})`);

  const spentBefore = await sumWon(auction.id, bid.userId);
  const removalCountBefore = await removalCount(auction.id, bid.userId, bid.playerId);

  // Plan par la couche pure (mêmes gardes que la route)
  const plan = planManualRemoval({ bid, auction, adminName: "DiagP2" });
  if (plan.error !== undefined) throw new Error(`Plan refusé : ${plan.error}`);
  const removal = plan.removal;

  // Transaction identique à la route
  const removed = await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRawUnsafe(
      "UPDATE AUCTION_BID SET status = 'removed' WHERE id = ? AND status = 'won'",
      bid.id
    );
    if (updated === 0) return false;
    await tx.$executeRawUnsafe(
      "INSERT INTO AUCTION_REMOVAL (auction_id, round, user_id, player_id, amount, reason) VALUES (?, ?, ?, ?, ?, ?)",
      removal.auctionId, removal.round, removal.userId, removal.playerId, removal.amount, removal.reason
    );
    return true;
  });
  assert(removed, "transaction appliquée (UPDATE conditionnel + INSERT removal)");

  // 1. Statut + ligne de traçabilité
  const after = await prisma.$queryRawUnsafe<{ status: string }[]>(
    "SELECT status FROM AUCTION_BID WHERE id = ?", bid.id
  );
  assert(after[0].status === "removed", `statut de la mise = 'removed' (lu : '${after[0].status}')`);
  const removals = await prisma.$queryRawUnsafe<{ reason: string; amount: number; round: number }[]>(
    "SELECT reason, amount, round FROM AUCTION_REMOVAL WHERE auction_id = ? AND user_id = ? AND player_id = ? ORDER BY id DESC LIMIT 1",
    auction.id, bid.userId, bid.playerId
  );
  assert(
    (await removalCount(auction.id, bid.userId, bid.playerId)) === removalCountBefore + 1,
    "une ligne AUCTION_REMOVAL insérée"
  );
  assert(removals[0]?.reason === "Retrait manuel par DiagP2", `reason tracé avec l'admin (lu : '${removals[0]?.reason}')`);
  assert(Number(removals[0]?.amount) === bid.amount && Number(removals[0]?.round) === bid.round, "montant et tour du removal fidèles à la mise");

  // 2. Idempotence : rejouer l'UPDATE conditionnel ne touche rien
  const replay = await prisma.$executeRawUnsafe(
    "UPDATE AUCTION_BID SET status = 'removed' WHERE id = ? AND status = 'won'",
    bid.id
  );
  assert(replay === 0, "rejeu (double-clic) : 0 ligne affectée");

  // 3. Budget recrédité (calculé sur les won)
  const spentAfter = await sumWon(auction.id, bid.userId);
  assert(spentAfter === spentBefore - bid.amount, `somme des won du participant : ${spentBefore} → ${spentAfter} (recrédit de ${bid.amount} pts)`);

  // 4. Joueur re-misable (takenIds = won)
  const taken = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    "SELECT COUNT(*) as cnt FROM AUCTION_BID WHERE auction_id = ? AND status = 'won' AND player_id = ?",
    auction.id, bid.playerId
  );
  assert(Number(taken[0].cnt) === 0, "le joueur n'est plus dans les takenIds (re-misable)");

  // Restauration de la copie (retrait annulé)
  await prisma.$executeRawUnsafe("UPDATE AUCTION_BID SET status = 'won' WHERE id = ?", bid.id);
  await prisma.$executeRawUnsafe(
    "DELETE FROM AUCTION_REMOVAL WHERE auction_id = ? AND user_id = ? AND player_id = ? AND reason = 'Retrait manuel par DiagP2'",
    auction.id, bid.userId, bid.playerId
  );
  console.log("Copie restaurée (mise remise à won, removal de diag supprimé).");
}

async function sumWon(auctionId: number, userId: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ total: number | null }[]>(
    "SELECT SUM(amount) as total FROM AUCTION_BID WHERE auction_id = ? AND user_id = ? AND status = 'won'",
    auctionId, userId
  );
  return Number(rows[0]?.total ?? 0);
}

async function removalCount(auctionId: number, userId: number, playerId: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    "SELECT COUNT(*) as cnt FROM AUCTION_REMOVAL WHERE auction_id = ? AND user_id = ? AND player_id = ?",
    auctionId, userId, playerId
  );
  return Number(rows[0].cnt);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
