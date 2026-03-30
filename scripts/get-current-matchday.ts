import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const latest = await prisma.score.findFirst({ orderBy: { day: "desc" } });
console.log(latest?.day ?? 27);
await prisma.$disconnect();
