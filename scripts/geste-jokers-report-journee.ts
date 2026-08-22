// Geste admin : reporter des jokers enregistrés sur une mauvaise journée
// d'effet (J1 2026-2027 : Skippy id 210 posé vendredi 14h52 et LST id 212
// posé samedi 00h07, tous deux après le cutoff jeudi 18h, donc effet J2).
//
// Usage : ./node_modules/.bin/tsx scripts/geste-jokers-report-journee.ts <effectDay> <jokerLogId...> [--apply]
// Sans --apply : dry-run, affiche l'état TEAM / TEAM_DAY et ce qui serait fait.
//
// Pour chaque joker : JOKER_LOG.day = effectDay - 1 ; TEAM sortant DAY_LAST =
// effectDay - 1 ; TEAM entrant DAY_FIRST = effectDay ; les compos des journées
// [ancien effet, effectDay - 1] retrouvent le sortant à la place de l'entrant ;
// la compo de effectDay (si elle existe) remplace le sortant par l'entrant.
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const nums = args.filter((a) => a !== "--apply").map(Number);
const [effectDay, ...ids] = nums;

async function main() {
  if (!effectDay || ids.length === 0) throw new Error("Usage : <effectDay> <jokerLogId...> [--apply]");
  for (const id of ids) {
    const [j] = await prisma.$queryRawUnsafe<{
      id: number; league_id: number; user_id: number; player_out_id: number; player_in_id: number; day: number;
    }[]>("SELECT id, league_id, user_id, player_out_id, player_in_id, day FROM JOKER_LOG WHERE id = ?", id);
    if (!j) { console.log(`#${id} : introuvable`); continue; }
    const leagueId = Number(j.league_id), userId = Number(j.user_id);
    const out = Number(j.player_out_id), inn = Number(j.player_in_id);
    const oldEffect = Number(j.day) + 1;
    console.log(`\n#${id} ligue ${leagueId} user ${userId} : ${out} -> ${inn}, effet J${oldEffect} => J${effectDay}`);
    if (oldEffect === effectDay) { console.log("  déjà bon, rien à faire"); continue; }
    if (effectDay < oldEffect) throw new Error("Ce geste ne gère que le report vers une journée ultérieure");

    const team = await prisma.$queryRawUnsafe(
      "SELECT ID_PLAYER, DAY_FIRST, DAY_LAST, IS_SUBS FROM TEAM WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER IN (?, ?) ORDER BY ID_PLAYER, DAY_FIRST",
      leagueId, userId, out, inn);
    console.log("  TEAM avant :", team);
    const lineups = await prisma.$queryRawUnsafe(
      "SELECT DAY, ID_PLAYER, INDX FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER IN (?, ?) AND DAY BETWEEN ? AND ? ORDER BY DAY, INDX",
      leagueId, userId, out, inn, oldEffect, effectDay);
    console.log("  TEAM_DAY concernées :", lineups);

    if (!apply) { console.log("  (dry-run)"); continue; }

    await prisma.$executeRawUnsafe("UPDATE JOKER_LOG SET day = ? WHERE id = ?", effectDay - 1, id);
    const r1 = await prisma.$executeRawUnsafe(
      "UPDATE TEAM SET DAY_LAST = ? WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY_LAST = ?",
      effectDay - 1, leagueId, userId, out, oldEffect - 1);
    const r2 = await prisma.$executeRawUnsafe(
      "UPDATE TEAM SET DAY_FIRST = ? WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY_FIRST = ?",
      effectDay, leagueId, userId, inn, oldEffect);
    // Journées où le sortant est de nouveau dans l'effectif : il reprend sa place.
    const r3 = await prisma.$executeRawUnsafe(
      "UPDATE TEAM_DAY SET ID_PLAYER = ? WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY BETWEEN ? AND ?",
      out, leagueId, userId, inn, oldEffect, effectDay - 1);
    // Journée d'effet : l'entrant remplace le sortant si une compo existe déjà.
    const r4 = await prisma.$executeRawUnsafe(
      "UPDATE TEAM_DAY SET ID_PLAYER = ? WHERE ID_LEAGUE = ? AND ID_USER = ? AND ID_PLAYER = ? AND DAY = ?",
      inn, leagueId, userId, out, effectDay);
    // Pas de compo pour la journée d'effet : recopie de la dernière connue avec
    // le remplacement (même logique que syncLineupForJoker dans la route).
    let r5 = 0;
    if (r4 === 0) {
      const exists = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        "SELECT COUNT(*) n FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY = ?", leagueId, userId, effectDay);
      if (Number(exists[0]?.n ?? 0) === 0) {
        r5 = await prisma.$executeRawUnsafe(
          `INSERT INTO TEAM_DAY (ID_LEAGUE, ID_USER, ID_PLAYER, DAY, INDX, IS_VALID, DT_SAVE, DT_VALID)
           SELECT ID_LEAGUE, ID_USER, IF(ID_PLAYER = ?, ?, ID_PLAYER), ?, INDX, IS_VALID, NOW(), NOW()
             FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY = (
               SELECT MAX(DAY) FROM TEAM_DAY WHERE ID_LEAGUE = ? AND ID_USER = ? AND DAY < ?)`,
          out, inn, effectDay, leagueId, userId, leagueId, userId, effectDay);
      }
    }
    console.log(`  appliqué : TEAM sortant ${r1}, TEAM entrant ${r2}, compos restaurées ${r3}, compo J${effectDay} modifiée ${r4}, compo J${effectDay} créée ${r5}`);
  }
}

main().finally(() => prisma.$disconnect());
