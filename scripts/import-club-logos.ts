/**
 * Import des logos de clubs manquants depuis football-data.org (crests
 * officiels, libres d'accès avec le token gratuit).
 *
 * ÉTAPE ANNUELLE du kick-off de saison, à lancer en dev APRÈS l'import des
 * clubs (stepper Nouvelle saison, étape 2) et AVANT commit :
 *
 *   ./node_modules/.bin/tsx scripts/import-club-logos.ts
 *
 * Pour chaque club de la saison courante en base :
 *   - si assets.ts résout déjà un logo ET que le PNG existe : rien à faire ;
 *   - sinon : télécharge le crest football-data dans public/clubs/<slug>.png
 *     (conversion via rsvg-convert si le crest est un SVG, cas Le Mans 2026)
 *     et affiche la ligne à ajouter/corriger dans CLUB_ASSETS (src/lib/assets.ts).
 *
 * Le script ne modifie PAS assets.ts lui-même : l'entrée (canonical, short,
 * aliases) reste une décision humaine d'1 ligne, car elle définit aussi le
 * trigramme et les alias de matching. Committer les PNG + la ligne, puis
 * vérifier avec scripts/diag-logos-saison-courante.ts (doit afficher N/N).
 *
 * Créé le 2026-08-17 après la saison des logos manquants (promus Troyes et
 * Le Mans absents de la table + 13 clubs sans alias football-data).
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import fs from "fs";
import { execFileSync } from "child_process";
import { prisma } from "../src/lib/prisma";
import { getFootballDataToken } from "../src/lib/football-api";
import { getClubLogoUrlByName, canonicalClubKey } from "../src/lib/assets";

const FD_BASE = "https://api.football-data.org/v4";

function slugify(canonical: string): string {
  return canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) { console.error("Aucune saison courante en base."); process.exit(1); }
  const clubs = await prisma.club.findMany({ where: { seasonId: season.id }, orderBy: { name: "asc" } });
  console.log(`Saison ${season.label} : ${clubs.length} clubs en base.\n`);

  const token = await getFootballDataToken();
  if (!token) { console.error("Pas de token football-data.org (Admin → Configuration ou env FOOTBALL_DATA_TOKEN)."); process.exit(1); }
  const res = await fetch(`${FD_BASE}/competitions/FL1/teams`, { headers: { "X-Auth-Token": token } });
  if (!res.ok) { console.error(`football-data.org HTTP ${res.status}`); process.exit(1); }
  const { teams } = (await res.json()) as { teams: { name: string; crest: string | null }[] };
  const crestByCanonical = new Map(teams.map((t) => [canonicalClubKey(t.name), t.crest]));

  const clubsDir = path.join(process.cwd(), "public", "clubs");
  const toAdd: string[] = [];

  for (const club of clubs) {
    const logo = getClubLogoUrlByName(club.name);
    const onDisk = logo && fs.existsSync(path.join(process.cwd(), "public", logo));
    if (logo && onDisk) { console.log(`OK    ${club.name} -> ${logo}`); continue; }

    const canonical = canonicalClubKey(club.name);
    const crest = crestByCanonical.get(canonical);
    if (!crest) {
      console.log(`MANQ  ${club.name} : aucun crest football-data (club hors L1 ? Légion ?). À traiter à la main.`);
      continue;
    }

    const slug = slugify(canonical);
    const dest = path.join(clubsDir, `${slug}.png`);
    const r = await fetch(crest);
    if (!r.ok) { console.log(`MANQ  ${club.name} : téléchargement ${crest} -> HTTP ${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());

    if (crest.endsWith(".svg") || buf.subarray(0, 300).toString("utf8").includes("<svg")) {
      // Crest SVG (rare) : conversion locale, rsvg-convert requis (brew install librsvg).
      const tmp = path.join(clubsDir, `${slug}.tmp.svg`);
      fs.writeFileSync(tmp, buf);
      try {
        execFileSync("rsvg-convert", ["-w", "200", "-h", "200", "--keep-aspect-ratio", tmp, "-o", dest]);
      } catch {
        console.log(`MANQ  ${club.name} : crest SVG, conversion impossible (installer rsvg-convert). SVG laissé dans ${tmp}`);
        continue;
      }
      fs.unlinkSync(tmp);
    } else {
      fs.writeFileSync(dest, buf);
    }
    console.log(`DL    ${club.name} -> /clubs/${slug}.png (${buf.length} octets, source ${crest})`);
    toAdd.push(`  { canonical: "${canonical}", short: "???", logo: "/clubs/${slug}.png", aliases: ["${club.name.toUpperCase()}"] },`);
  }

  if (toAdd.length > 0) {
    console.log(`\nLignes à ajouter/corriger dans CLUB_ASSETS (src/lib/assets.ts), trigramme à choisir :\n`);
    toAdd.forEach((l) => console.log(l));
    console.log(`\nPuis : ./node_modules/.bin/tsx scripts/diag-logos-saison-courante.ts pour vérifier, et committer PNG + assets.ts.`);
  } else {
    console.log(`\nTous les clubs de la saison ont un logo. Rien à committer.`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
