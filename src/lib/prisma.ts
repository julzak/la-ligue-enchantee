import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Build a parameterized IN clause: returns ["?,?,?", [1,2,3]]
 * Usage: const [ph, vals] = inParams(ids);
 *        prisma.$queryRawUnsafe(`SELECT ... WHERE id IN (${ph})`, ...vals)
 */
export function inParams(values: number[]): [string, number[]] {
  return [values.map(() => "?").join(","), values];
}
