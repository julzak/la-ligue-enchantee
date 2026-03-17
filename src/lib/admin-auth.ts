import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

// Admin user IDs — can be extended or moved to DB later
const ADMIN_USER_IDS = new Set<number>([
  // Add admin user IDs here. For now, any logged-in user can access admin.
  // TODO: add a proper admin flag to the USER table
]);

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
 * If ADMIN_USER_IDS is empty, falls back to requireAuth (any logged-in user).
 */
export async function requireAdmin(): Promise<
  { session: { user: { name?: string; email?: string; userId?: number } }; error?: never } |
  { session?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  // If admin IDs are configured, check membership
  if (ADMIN_USER_IDS.size > 0) {
    const userId = (result.session.user as { userId?: number }).userId;
    if (!userId || !ADMIN_USER_IDS.has(userId)) {
      return { error: NextResponse.json({ error: "Accès admin requis" }, { status: 403 }) };
    }
  }

  return result;
}
