import { NextResponse } from "next/server";
import { getLeagues } from "@/lib/db";
// import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  // Auth temporarily disabled for dev — TODO: re-enable
  // const auth = await requireAdmin();
  // if (auth.error) return auth.error;
  const leagues = await getLeagues();
  return NextResponse.json({ leagues });
}
