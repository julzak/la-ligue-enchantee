import { NextResponse } from "next/server";

// In-memory cache for player image URLs (persists across requests in same process)
const cache = new Map<number, string | null>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = Number(searchParams.get("id") ?? 0);
  const playerName = searchParams.get("name") ?? "";

  if (!playerId || !playerName) {
    return NextResponse.json({ url: null });
  }

  // Check cache
  if (cache.has(playerId)) {
    return NextResponse.json({ url: cache.get(playerId) });
  }

  try {
    // Search Sofascore for this player
    const searchName = playerName.split(" ").pop() ?? playerName; // Use last name for better match
    const res = await fetch(
      `https://api.sofascore.com/api/v1/search/players?query=${encodeURIComponent(searchName)}&page=0`,
      {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(3000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const players = data?.results ?? data?.players ?? [];

      // Try to find best match
      const normalizedInput = playerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const match = players.find((p: { name?: string }) => {
        const normalizedResult = (p.name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedResult.includes(normalizedInput) || normalizedInput.includes(normalizedResult);
      });

      if (match?.id) {
        const url = `https://img.sofascore.com/api/v1/player/${match.id}/image`;
        cache.set(playerId, url);
        return NextResponse.json({ url });
      }
    }
  } catch {
    // Timeout or error, skip
  }

  cache.set(playerId, null);
  return NextResponse.json({ url: null });
}
