import { prisma } from "../src/lib/prisma";

// Croise l'historique PALMARES (position 1 par division) avec les étoiles
// actuellement portées dans USER.NAME pour confirmer la sémantique des couleurs.
async function main() {
  const champs = await prisma.$queryRawUnsafe<{ SEASON: string; DIVISION_LABEL: string; POSITION: string; PSEUDO: string }[]>(
    `SELECT s.LABEL as SEASON, p.DIVISION_LABEL, p.POSITION, p.PSEUDO
     FROM PALMARES p JOIN SEASON s ON s.ID_SEASON = p.ID_SEASON
     WHERE p.POSITION IN ('1', 'Vainqueur')
     ORDER BY s.LABEL, p.DIVISION_LABEL`
  );
  console.log("Titres (position 1 / vainqueur) par saison:");
  for (const c of champs) console.log(`  ${c.SEASON} | ${c.DIVISION_LABEL} | ${c.PSEUDO}`);

  // Étoiles actuelles des pseudos titrés
  const pseudos = [...new Set(champs.map((c) => c.PSEUDO))];
  const users = await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
    "SELECT ID_USER, NAME FROM USER WHERE NAME LIKE '%<img%'"
  );
  console.log("\nÉtoiles actuelles des titrés:");
  for (const p of pseudos) {
    const matches = users.filter((u) => u.NAME.replace(/<[^>]*>/g, "").trim().toLowerCase().includes(p.toLowerCase()));
    for (const u of matches) {
      const imgs = (u.NAME.match(/src="[^"]*"/g) ?? []).map((s) => s.slice(5, -1).split("/").pop());
      console.log(`  ${p} -> #${u.ID_USER} ${u.NAME.replace(/<[^>]*>/g, "").trim()}: ${imgs.join(", ")}`);
    }
    if (matches.length === 0) console.log(`  ${p} -> (aucune étoile actuellement / pseudo non trouvé)`);
  }
}

main().finally(() => prisma.$disconnect());
