/**
 * Attribution rétroactive au TOUR 4 des joueurs de la mise non soumise de
 * Capra (user 1366), enchère 9 (L1). Décision admins (Laurent/Pierre, WhatsApp
 * 2026-08-17 22:06) : au tour 4, ces joueurs n'avaient aucune autre mise, il
 * les aurait eus.
 *
 * Par défaut, attribue les 3 joueurs SANS AUCUNE CONCURRENCE à date :
 *   Kehrer 3, Gomes 2, Bernardeau 2 (won au round 4, admin_entered_by=112),
 * et retire ces 3 lignes de sa mise pending du tour 5. Sa mise Witsel 15
 * RESTE au tour 5, disputée à la concurrence (une autre mise existe).
 *
 * Avec --avec-witsel : attribue AUSSI Witsel 15 au tour 4, et supprime les
 * deux mises pending du tour 5 sur Witsel (la sienne et celle du concurrent).
 * ⚠️ À ne lancer que si les admins assument de retirer sa seule mise du tour
 * à l'autre participant (qui devra re-soumettre avant la clôture).
 *
 * Idempotent : les INSERT sont protégés par unique_bid (ON DUPLICATE KEY
 * UPDATE sans effet si déjà won). Abandon si le tour 5 n'est plus open.
 *
 * Usage : ./node_modules/.bin/tsx scripts/admin-retro-capra-r4.ts [--avec-witsel]
 */
import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/lib/prisma";

const AUCTION_ID = 9, RETRO_ROUND = 4, CURRENT_ROUND = 5, USER_ID = 1366, ADMIN_ID = 112;
const SAFE = [
  { playerId: 18349, amount: 3, label: "Thilo Kehrer (DEF)" },
  { playerId: 18012, amount: 2, label: "Angel Gomes (MIL)" },
  { playerId: 18183, amount: 2, label: "Gabin Bernardeau (MIL)" },
];
const WITSEL = { playerId: 18481, amount: 15, label: "Axel Witsel (DEF)" };
const avecWitsel = process.argv.includes("--avec-witsel");

async function main() {
  const a = await prisma.$queryRawUnsafe<{ status: string; current_round: number }[]>(
    "SELECT status, current_round FROM AUCTION WHERE id = ?", AUCTION_ID);
  if (a[0]?.status !== "open" || Number(a[0]?.current_round) !== CURRENT_ROUND) {
    throw new Error(`État inattendu : status=${a[0]?.status} round=${a[0]?.current_round} (attendu open/R${CURRENT_ROUND}), abandon.`);
  }

  const targets = avecWitsel ? [...SAFE, WITSEL] : SAFE;

  // Garde : aucun des joueurs à attribuer ne doit être 'won' par un AUTRE.
  const ids = targets.map((t) => t.playerId).join(",");
  const wonByOther = await prisma.$queryRawUnsafe<{ player_id: number; user_id: number }[]>(
    `SELECT player_id, user_id FROM AUCTION_BID WHERE auction_id = ? AND status = 'won' AND user_id != ? AND player_id IN (${ids})`,
    AUCTION_ID, USER_ID);
  if (wonByOther.length > 0) {
    throw new Error(`Conflit : joueur(s) déjà attribué(s) à un autre participant : ${JSON.stringify(wonByOther)}. Abandon.`);
  }

  await prisma.$transaction(async (tx) => {
    for (const t of targets) {
      // Attribution rétroactive au tour 4, tracée saisie admin.
      await tx.$executeRawUnsafe(
        `INSERT INTO AUCTION_BID (auction_id, round, user_id, player_id, amount, status, admin_entered_by)
         VALUES (?, ?, ?, ?, ?, 'won', ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount), status = 'won', admin_entered_by = VALUES(admin_entered_by)`,
        AUCTION_ID, RETRO_ROUND, USER_ID, t.playerId, t.amount, ADMIN_ID);
      // Retrait des mises pending du tour 5 sur ce joueur (la sienne, et en
      // mode --avec-witsel celle du concurrent, le joueur n'étant plus libre).
      await tx.$executeRawUnsafe(
        avecWitsel
          ? "DELETE FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND player_id = ? AND status = 'pending'"
          : "DELETE FROM AUCTION_BID WHERE auction_id = ? AND round = ? AND player_id = ? AND status = 'pending' AND user_id = " + USER_ID,
        AUCTION_ID, CURRENT_ROUND, t.playerId);
    }
  });

  console.log(`Attribué au R${RETRO_ROUND} : ${targets.map((t) => `${t.label} ${t.amount} pts`).join(", ")}`);

  const state = await prisma.$queryRawUnsafe<{ LNAME: string; round: number; status: string; amount: number }[]>(
    `SELECT p.LNAME, b.round, b.status, b.amount FROM AUCTION_BID b JOIN PLAYER p ON p.ID_PLAYER = b.player_id
      WHERE b.auction_id = ? AND b.user_id = ? AND b.status IN ('won','pending') ORDER BY b.status, b.round, p.LNAME`,
    AUCTION_ID, USER_ID);
  const won = state.filter((s) => s.status === "won");
  const spent = won.reduce((s, r) => s + Number(r.amount), 0);
  console.log(`\nCapra : ${won.length}/13 acquis, ${spent}/130 pts dépensés.`);
  state.filter((s) => s.status === "pending").forEach((s) => console.log(`  pending R${s.round} : ${s.LNAME} ${s.amount} pts`));
}

main().then(() => process.exit(0)).catch((e) => { console.error("ÉCHEC:", e.message); process.exit(1); });
