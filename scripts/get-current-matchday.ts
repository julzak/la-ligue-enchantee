import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const latest = await prisma.score.findFirst({ orderBy: { day: "desc" } });
  console.log(latest?.day ?? 27);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
