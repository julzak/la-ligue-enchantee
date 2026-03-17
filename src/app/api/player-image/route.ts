import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = Number(searchParams.get("id") ?? 0);

  if (!playerId) {
    return NextResponse.json({ url: null });
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ PHOTO_URL: string | null }[]>(
      "SELECT PHOTO_URL FROM PLAYER WHERE ID_PLAYER = ? LIMIT 1",
      playerId
    );

    const url = rows[0]?.PHOTO_URL || null;
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: null });
  }
}
