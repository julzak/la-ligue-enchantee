import fs from "fs";
import path from "path";

const PLAYERS_FILE = path.join(__dirname, "../src/fixtures/players.json");
const API_BASE = "https://www.thesportsdb.com/api/v1/json/3/searchplayers.php";
const DELAY_MS = 500;

interface Player {
  id: string;
  name: string;
  position: string;
  clubId: string;
  imageUrl?: string | null;
}

interface SportsDBPlayer {
  strCutout?: string | null;
  strThumb?: string | null;
  strPlayer?: string;
}

interface SportsDBResponse {
  player: SportsDBPlayer[] | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchPlayer(name: string): Promise<string | null> {
  const url = `${API_BASE}?p=${encodeURIComponent(name)}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`  HTTP ${res.status} for "${name}"`);
    return null;
  }

  const data = (await res.json()) as SportsDBResponse;

  if (!data.player || data.player.length === 0) {
    return null;
  }

  const player = data.player[0];
  return player.strCutout || player.strThumb || null;
}

async function main() {
  console.log("Reading players.json...");
  const raw = fs.readFileSync(PLAYERS_FILE, "utf-8");
  const players: Player[] = JSON.parse(raw);
  console.log(`Found ${players.length} players.\n`);

  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];

    try {
      const imageUrl = await searchPlayer(player.name);

      if (imageUrl) {
        player.imageUrl = imageUrl;
        found++;
        console.log(`  ✓ ${player.name} → found`);
      } else {
        // Keep existing imageUrl or set null if none
        if (!player.imageUrl) {
          player.imageUrl = null;
        }
        notFound++;
        console.log(`  ✗ ${player.name} → not found (keeping existing)`);
      }
    } catch (err) {
      errors++;
      console.error(`  ✗ ${player.name} → error: ${err instanceof Error ? err.message : err}`);
    }

    // Progress every 10 players
    if ((i + 1) % 10 === 0) {
      console.log(`\n--- Progress: ${i + 1}/${players.length} (found: ${found}, not found: ${notFound}, errors: ${errors}) ---\n`);
    }

    // Be nice to the API
    if (i < players.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Write back
  console.log("\nWriting updated players.json...");
  fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2) + "\n", "utf-8");

  // Summary
  console.log("\n========== SUMMARY ==========");
  console.log(`Total players: ${players.length}`);
  console.log(`Found:         ${found}`);
  console.log(`Not found:     ${notFound}`);
  console.log(`Errors:        ${errors}`);
  console.log("=============================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
