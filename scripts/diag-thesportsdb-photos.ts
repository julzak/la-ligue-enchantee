/**
 * Diagnostic : couverture photos joueurs TheSportsDB sur les 18 clubs de
 * Ligue 1, via l'endpoint effectif (lookup_all_players). Clé gratuite =
 * échantillon plafonné à 10 entrées par club ; le premium lève ce plafond.
 * But : objectiver la couverture AVANT de payer l'abonnement.
 *
 * Usage : ./node_modules/.bin/tsx scripts/diag-thesportsdb-photos.ts
 */

const KEY = "3"; // clé de test publique
const STAFF_POSITIONS = /manager|coach|assistant|director|goalkeeping/i;

interface SdbPlayer {
  strPlayer: string;
  strPosition: string | null;
  strCutout: string | null;
  strThumb: string | null;
}

async function main() {
  const teamsRes = await fetch(
    `https://www.thesportsdb.com/api/v1/json/${KEY}/search_all_teams.php?l=French%20Ligue%201`
  );
  const teamsData = await teamsRes.json();
  const teams: { idTeam: string; strTeam: string }[] = teamsData.teams ?? [];
  console.log(`${teams.length} clubs trouvés dans "French Ligue 1"\n`);

  let totalPlayers = 0;
  let withPhoto = 0;
  let staff = 0;

  for (const team of teams) {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${KEY}/lookup_all_players.php?id=${team.idTeam}`
    );
    const data = await res.json();
    const entries: SdbPlayer[] = data.player ?? [];
    const players = entries.filter((p) => !STAFF_POSITIONS.test(p.strPosition ?? ""));
    staff += entries.length - players.length;
    const photos = players.filter((p) => p.strCutout || p.strThumb);
    totalPlayers += players.length;
    withPhoto += photos.length;
    console.log(
      `${team.strTeam.padEnd(22)} ${photos.length}/${players.length} photos (échantillon free)`
    );
    await new Promise((r) => setTimeout(r, 2200)); // rate limit free : 30 req/min
  }

  console.log(`\nTOTAL : ${withPhoto}/${totalPlayers} joueurs avec photo (${Math.round((100 * withPhoto) / totalPlayers)}%)`);
  console.log(`(${staff} entrées staff exclues. Échantillon = 10 entrées max/club en gratuit,`);
  console.log(`possiblement biaisé vers les joueurs connus : la couverture sur effectif`);
  console.log(`COMPLET, fonds de banc inclus, sera probablement plus basse. À re-mesurer`);
  console.log(`avec la clé premium au contrôle de juillet avant d'engager la saison.)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
