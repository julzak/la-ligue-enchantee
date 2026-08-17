/**
 * Saisie admin de la mise de Capra (user 1366) au tour 5 de l'enchère 9 (L1).
 *
 * Réplique EXACTE de l'action console « Saisir une mise pour un participant »
 * (enter-bid-for-user) : validation partagée validateSummerBids, remplacement
 * des 'pending' du tour, traçabilité admin_entered_by. Décision des admins
 * (Laurent/Pierre, WhatsApp 2026-08-17), exécution demandée par Julien.
 * admin_entered_by = 112 (Kazu / Julien).
 *
 * Montants relevés sur la photo de Capdevielle (12:50) : Witsel 15, Kehrer 3,
 * Gomes 2, Bernardeau 2 = 22 pts, pile son budget restant (108 dépensés sur
 * 130), et 9 acquis + 4 = 13 joueurs.
 *
 * Usage : ./node_modules/.bin/tsx scripts/admin-entry-capra-r5.ts
 * Idempotent (remplace les pending du tour) ; Capra peut re-soumettre par
 * dessus jusqu'à la deadline du 18/08 12:00.
 */
import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/lib/prisma";
import { validateSummerBids } from "../src/lib/auction-validation";

const AUCTION_ID = 9, ROUND = 5, USER_ID = 1366, ADMIN_ID = 112;
const BIDS = [
  { playerId: 18481, amount: 15 }, // Axel Witsel (DEF)
  { playerId: 18349, amount: 3 },  // Thilo Kehrer (DEF)
  { playerId: 18012, amount: 2 },  // Angel Gomes (MIL)
  { playerId: 18183, amount: 2 },  // Gabin Bernardeau (MIL)
];

async function main() {
  // Gardes identiques à la console : enchère ouverte, tour attendu.
  const a = await prisma.$queryRawUnsafe<{ status: string; current_round: number }[]>(
    "SELECT status, current_round FROM AUCTION WHERE id = ?", AUCTION_ID);
  if (a[0]?.status !== "open" || Number(a[0]?.current_round) !== ROUND) {
    throw new Error(`État inattendu : status=${a[0]?.status} round=${a[0]?.current_round} (attendu open/R${ROUND}), abandon.`);
  }
  const err = await validateSummerBids(prisma, AUCTION_ID, USER_ID, BIDS);
  if (err) throw new Error(`Validation refusée (${err.status}) : ${err.error}`);
  console.log("Validation partagée : OK");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "DELETE FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND user_id = ? AND status = 'pending'",
      AUCTION_ID, ROUND, USER_ID);
    for (const b of BIDS) {
      await tx.$executeRawUnsafe(
        "INSERT INTO AUCTION_BID (auction_id, round, user_id, player_id, amount, status, admin_entered_by) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        AUCTION_ID, ROUND, USER_ID, b.playerId, b.amount, ADMIN_ID);
    }
  });

  const check = await prisma.$queryRawUnsafe<{ FNAME: string; LNAME: string; amount: number; status: string; admin_entered_by: number; created_at: Date }[]>(
    "SELECT p.FNAME, p.LNAME, b.amount, b.status, b.admin_entered_by, b.created_at FROM AUCTION_BID b JOIN PLAYER p ON p.ID_PLAYER=b.player_id WHERE b.auction_id=? AND b.round=? AND b.user_id=? ORDER BY b.amount DESC",
    AUCTION_ID, ROUND, USER_ID);
  console.log("\nRelecture :");
  check.forEach((r) => console.log(`  ${r.FNAME} ${r.LNAME} | ${r.amount} pts | ${r.status} | saisi par admin ${r.admin_entered_by} | ${r.created_at.toISOString()}`));
}

main().then(() => process.exit(0)).catch((e) => { console.error("ÉCHEC:", e.message); process.exit(1); });
