/**
 * Diagnostic : logo et trigramme résolus pour chaque club de la saison
 * courante. Lecture seule. Créé le 2026-08-17 après le signalement de Laurent
 * (« les logos de clubs sont aléatoires, il en manque un certain nombre »).
 */
import dotenv from "dotenv"; dotenv.config();
import { prisma } from "../src/lib/prisma";
import { getClubLogoUrlByName, getClubShortNameByName, canonicalClubKey } from "../src/lib/assets";
import fs from "fs";
import path from "path";

async function main() {
  const cur = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!cur) { console.log("Aucune saison courante."); return; }
  const clubs = await prisma.club.findMany({ where: { seasonId: cur.id }, orderBy: { name: "asc" } });
  console.log(`Saison ${cur.label} — ${clubs.length} clubs\n`);
  let ok = 0, missing: string[] = [], broken: string[] = [];
  for (const c of clubs) {
    const logo = getClubLogoUrlByName(c.name);
    const onDisk = logo ? fs.existsSync(path.join(process.cwd(), "public", logo)) : false;
    if (logo && onDisk) ok++;
    else if (!logo) missing.push(c.name);
    else broken.push(`${c.name} -> ${logo} (fichier absent)`);
    console.log(`  ${logo && onDisk ? "OK  " : "MANQ"} ${c.name.padEnd(26)} ${getClubShortNameByName(c.name).padEnd(6)} ${canonicalClubKey(c.name).padEnd(18)} ${logo ?? "-"}`);
  }
  console.log(`\nRésolu : ${ok}/${clubs.length}`);
  if (missing.length) console.log(`Sans entrée logo : ${missing.join(", ")}`);
  if (broken.length) console.log(`Entrée présente mais PNG absent : ${broken.join(", ")}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
