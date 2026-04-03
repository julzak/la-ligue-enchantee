export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isUserAdmin } from "@/lib/admin-auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ isAdmin: false });
  }
  const userId = (session.user as { userId?: number }).userId;
  if (!userId) {
    return NextResponse.json({ isAdmin: false });
  }
  const admin = await isUserAdmin(userId);
  return NextResponse.json({ isAdmin: admin });
}
