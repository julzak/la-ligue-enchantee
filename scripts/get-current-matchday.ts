import { PrismaClient } from "@prisma/client";
import { resolveCurrentMatchday } from "./lib/season";

async function main() {
  const prisma = new PrismaClient();
  console.log(await resolveCurrentMatchday(prisma));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
