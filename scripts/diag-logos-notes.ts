// Vérifie que chaque club de la saison courante résout vers un logo via
// getClubLogoUrlByName (fix grille de notes admin, mapping ID -> nom).
import { PrismaClient } from "@prisma/client";
import { getClubLogoUrlByName } from "../src/lib/assets";

const prisma = new PrismaClient();

async function main() {
  const clubs = await prisma.club.findMany({
    where: { id: { gte: 500 } },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  let missing = 0;
  for (const c of clubs) {
    const logo = getClubLogoUrlByName(c.name);
    if (!logo) missing++;
    console.log(`${c.id}\t${c.name}\t${logo ?? "❌ AUCUN LOGO"}`);
  }
  console.log(`\n${clubs.length} clubs, ${missing} sans logo`);
  await prisma.$disconnect();
}

main();
