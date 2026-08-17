import dotenv from "dotenv"; dotenv.config();
import { prisma } from "../src/lib/prisma";
import { getAppConfig, CONFIG_KEYS } from "../src/lib/app-config";
async function main() {
  const r = await prisma.$queryRawUnsafe<any[]>("SHOW CREATE TABLE MATCH_SCHEDULE");
  console.log("TABLE:", Object.values(r[0]).join("\n").replace(/,\n/g, "\n"));
  const token = await getAppConfig(CONFIG_KEYS.FOOTBALL_DATA_TOKEN);
  const res = await fetch("https://api.football-data.org/v4/competitions/FL1/teams", { headers: { "X-Auth-Token": token! } });
  const d: any = await res.json();
  console.log("\nCRESTS football-data:", (d.teams||[]).length, "équipes");
  for (const t of (d.teams||[]).slice(0,20)) console.log(`  ${String(t.id).padEnd(5)} ${String(t.name).padEnd(26)} ${t.crest ?? "PAS DE CREST"}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
