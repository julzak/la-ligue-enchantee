/**
 * Import one-shot du palmarès historique depuis un CSV.
 *
 * Colonnes attendues (en-tête obligatoire, ordre libre) : annee, division, position, pseudo
 *   annee    : "2024" ou "2023-2024" (le label de saison sera construit ainsi)
 *   division : "Ligue 1", "Ligue 2", "National 1", ..., "Coupe"
 *   position : "1" / "2" / "3" pour les championnats, "Vainqueur" / "Finaliste" pour la coupe
 *   pseudo   : nom affiché
 *
 * Pour chaque année rencontrée, crée (si absente) une Season CLOSED dont le
 * label = la valeur "annee", puis insère les lignes PALMARES rattachées.
 * Idempotent : ré-exécuter efface d'abord les lignes PALMARES des saisons
 * concernées par le CSV avant de réinsérer.
 *
 * Usage : ./node_modules/.bin/tsx scripts/import-palmares.ts <chemin.csv>
 * (npm 11 casse npx ; utiliser le binaire local directement.)
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CsvRow {
  annee: string;
  division: string;
  position: string;
  pseudo: string;
}

// Parseur CSV minimal (gère les guillemets et les virgules entre guillemets).
function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    annee: header.indexOf("annee"),
    division: header.indexOf("division"),
    position: header.indexOf("position"),
    pseudo: header.indexOf("pseudo"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`Colonne manquante dans le CSV : "${k}"`);
  }

  return lines.slice(1).map((line) => {
    const cols = splitLine(line);
    return {
      annee: cols[idx.annee] ?? "",
      division: cols[idx.division] ?? "",
      position: cols[idx.position] ?? "",
      pseudo: cols[idx.pseudo] ?? "",
    };
  });
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage : ./node_modules/.bin/tsx scripts/import-palmares.ts <chemin.csv>");
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(path, "utf8")).filter(
    (r) => r.annee && r.division && r.position && r.pseudo
  );
  if (rows.length === 0) {
    console.error("Aucune ligne valide dans le CSV.");
    process.exit(1);
  }

  // 1. Saisons (une par "annee").
  const labels = Array.from(new Set(rows.map((r) => r.annee)));
  const seasonIdByLabel = new Map<string, number>();
  for (const label of labels) {
    let season = await prisma.season.findFirst({ where: { label } });
    if (!season) {
      season = await prisma.season.create({
        data: { label, status: "CLOSED", closedAt: new Date(), isCurrent: false },
      });
      console.log(`Saison créée : ${label} (#${season.id})`);
    }
    seasonIdByLabel.set(label, season.id);
  }

  // 2. Idempotence : purge des PALMARES des saisons concernées.
  const seasonIds = Array.from(seasonIdByLabel.values());
  const purged = await prisma.palmares.deleteMany({ where: { seasonId: { in: seasonIds } } });
  if (purged.count > 0) console.log(`Purge de ${purged.count} ligne(s) PALMARES existantes.`);

  // 3. Insertion.
  const data = rows.map((r) => ({
    seasonId: seasonIdByLabel.get(r.annee)!,
    divisionLabel: r.division,
    position: r.position,
    pseudo: r.pseudo,
  }));
  const created = await prisma.palmares.createMany({ data });
  console.log(`Import terminé : ${created.count} ligne(s) PALMARES sur ${labels.length} saison(s).`);
}

main()
  .catch((e) => {
    console.error("Erreur import :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
