import { prisma } from "../src/lib/prisma";
import { getCurrentSeasonKey } from "../src/lib/season";
async function main() {
  console.log("seasonKey:", await getCurrentSeasonKey());
  console.log(await prisma.$queryRawUnsafe("SELECT season, COUNT(*) as n, SUM(paid) as paid FROM PAYMENT GROUP BY season ORDER BY season"));
  console.log(await prisma.$queryRawUnsafe("DESCRIBE PAYMENT"));
}
main().finally(() => prisma.$disconnect());
