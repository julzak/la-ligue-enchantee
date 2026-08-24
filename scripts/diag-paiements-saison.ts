// Diag bug Pierre 2026-08-24 : module admin paiements vide en 2026-2027.
import { prisma } from "../src/lib/prisma";

async function main() {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  console.log("Saison courante:", season?.id, season?.label);

  const bySeason = await prisma.$queryRawUnsafe<{ season: string; n: bigint; paid: bigint }[]>(
    "SELECT season, COUNT(*) n, SUM(paid) paid FROM PAYMENT GROUP BY season ORDER BY season"
  );
  console.log("PAYMENT par saison:", bySeason.map((r) => `${r.season}: ${Number(r.n)} rows (${Number(r.paid)} payés)`));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
// (relance : requête exacte de la route admin/paiements)
