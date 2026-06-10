/**
 * Test de non-régression : helpers purs du scoping saison (season-key.ts).
 *
 * Garantit :
 *  - les 3 ligues historiques gardent leurs slugs publiés (URLs /ligue/[slug])
 *  - le slugify générique couvre les ligues des saisons futures (l'ancien code
 *    renvoyait "ligue-2" pour TOUT nom hors baudens/national : sanity-check inclus)
 *  - la clé saison SQL/TheSportsDB "YYYY-YYYY" se dérive du label Season
 *
 * Usage : ./node_modules/.bin/tsx scripts/test-season-scoping.ts
 */

import { leagueSlug, seasonKeyFromLabel, LEGACY_SEASON_KEY } from "../src/lib/season-key";
import { canonicalClubKey, getClubLogoUrlByName, getClubShortNameByName } from "../src/lib/assets";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "OK " : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (attendu ${JSON.stringify(expected)})`}`);
}

console.log("── Slugs des ligues historiques (URLs publiées, ne doivent JAMAIS changer)");
check("Baudens", leagueSlug("Ligue 1 (Baudens League)"), "ligue-1");
check("National 1", leagueSlug("National 1"), "national-1");
check("Ligue 2", leagueSlug("Ligue 2"), "ligue-2");

console.log("── Slugify générique (saisons futures)");
check("Ligue 3", leagueSlug("Ligue 3"), "ligue-3");
check("diacritiques", leagueSlug("Ligue Étoilée"), "ligue-etoilee");
check("espaces/symboles", leagueSlug("La  Super-Ligue !"), "la-super-ligue");
check("vide", leagueSlug("  "), "ligue");

// Sanity-check : l'ancien code (slug codé en dur) renvoyait "ligue-2" pour tout
// nom hors baudens/national. Si quelqu'un réintroduit ce comportement, ce test
// doit le détecter : "Ligue 4" ne doit PAS donner "ligue-2".
console.log("── Sanity-check anti-régression (ancien hardcode)");
const ligue4 = leagueSlug("Ligue 4");
check("Ligue 4 n'est pas l'ancien défaut", ligue4 === "ligue-2" ? "REGRESSION-hardcode" : ligue4, "ligue-4");

console.log("── Clé saison SQL/TheSportsDB depuis le label Season");
check("label année seule", seasonKeyFromLabel("2027"), "2026-2027");
check("label complet", seasonKeyFromLabel("2026-2027"), "2026-2027");
check("label avec espaces", seasonKeyFromLabel(" 2026 "), "2025-2026");
check("label legacy 2026 = clé actuelle", seasonKeyFromLabel("2026"), LEGACY_SEASON_KEY);
check("label invalide", seasonKeyFromLabel("saison de ouf"), null);

console.log("── Assets clubs par nom : noms DB legacy");
check("MARSEILLE (OM) → logo", getClubLogoUrlByName("MARSEILLE (OM)"), "/clubs/marseille.png");
check("PARIS-SG (PSG) → short", getClubShortNameByName("PARIS-SG (PSG)"), "PSG");
check("Légion étrangère → logo", getClubLogoUrlByName("Légion étrangère"), "/clubs/legion-etrangere.png");
check("LYON (OL) → short", getClubShortNameByName("LYON (OL)"), "OL");

console.log("── Assets clubs par nom : variantes TheSportsDB (MATCH_SCHEDULE)");
check("Olympique Marseille → logo", getClubLogoUrlByName("Olympique Marseille"), "/clubs/marseille.png");
check("Paris SG → logo", getClubLogoUrlByName("Paris SG"), "/clubs/psg.png");
check("Paris Saint Germain → short", getClubShortNameByName("Paris Saint Germain"), "PSG");
check("Paris (= Paris FC) → short", getClubShortNameByName("Paris"), "PFC");
check("Angers SCO → logo", getClubLogoUrlByName("Angers SCO"), "/clubs/angers.png");

console.log("── Appariement MATCH_SCHEDULE ↔ CLUB (clé canonique)");
// Le nom DB et le nom TheSportsDB du même club doivent donner la MÊME clé :
// c'est ce qui permet à getLockedClubIds de retrouver le club de la saison.
check("OM : DB == TheSportsDB", canonicalClubKey("MARSEILLE (OM)") === canonicalClubKey("Olympique Marseille"), true);
check("PSG : DB == TheSportsDB", canonicalClubKey("PARIS-SG (PSG)") === canonicalClubKey("Paris SG"), true);
check("Paris FC ≠ PSG", canonicalClubKey("Paris") !== canonicalClubKey("Paris SG"), true);
check("club inconnu : clé normalisée", canonicalClubKey("Saint-Étienne"), "SAINT ETIENNE");
check("club inconnu : logo null", getClubLogoUrlByName("Saint-Étienne"), null);
check("club inconnu : short = fallback", getClubShortNameByName("Saint-Étienne", "ASSE"), "ASSE");

if (failures > 0) {
  console.error(`\n${failures} échec(s)`);
  process.exit(1);
}
console.log("\nTous les tests passent.");
