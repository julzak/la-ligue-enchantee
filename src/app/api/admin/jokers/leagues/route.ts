import { NextResponse } from "next/server";
import { getLeagues } from "@/lib/db";

export async function GET() {
  const leagues = await getLeagues();
  return NextResponse.json({ leagues });
}
