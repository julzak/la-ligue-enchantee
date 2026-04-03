import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

// Cache admin IDs in memory for 5 minutes to avoid hitting DB on every request
let cachedAdminIds: Set<number> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAdminIds(): Promise<Set<number>> {
  const now = Date.now();
  if (cachedAdminIds && now - cacheTime < CACHE_TTL) {
    return cachedAdminIds;
  }
  const rows = await prisma.$queryRawUnsafe<{ user_id: number }[]>(
    "SELECT user_id FROM ADMIN_USER"
  );
  cachedAdminIds = new Set(rows.map((r) => r.user_id));
  cacheTime = now;
  return cachedAdminIds;
}

/** Force-refresh the admin cache (call after add/remove) */
export function invalidateAdminCache() {
  cachedAdminIds = null;
  cacheTime = 0;
}

/**
 * Check if a given user ID is an admin.
 */
export async function isUserAdmin(userId: number): Promise<boolean> {
  const adminIds = await getAdminIds();
  return adminIds.has(userId);
}

/**
 * Check if the request is from an authenticated user.
 * Returns the session if valid, or a 401 response if not.
 */
export async function requireAuth(): Promise<
  { session: { user: { name?: string; email?: string; userId?: number } }; error?: never } |
  { session?: never; error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  return { session: session as { user: { name?: string; email?: string; userId?: number } } };
}

/**
 * Check if the request is from an admin user.
 */
export async function requireAdmin(): Promise<
  { session: { user: { name?: string; email?: string; userId?: number } }; error?: never } |
  { session?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  const userId = (result.session.user as { userId?: number }).userId;
  if (!userId || !(await isUserAdmin(userId))) {
    return { error: NextResponse.json({ error: "Accès admin requis" }, { status: 403 }) };
  }

  return result;
}
