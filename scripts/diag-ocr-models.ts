// Compare l'OCR des infographies L'Équipe (tmp/infographics, J26 2025-2026)
// entre gemini-2.5-flash et gemini-3.8-flash, même appel SDK et même prompt que
// scripts/process-matchday.ts. Affiche les écarts pour arbitrage visuel.
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const DIR = path.join(__dirname, "..", "tmp/infographics");
const MODELS = (process.env.DIAG_MODELS ?? "gemini-2.5-flash,gemini-3.8-flash").split(",");
const PROMPT = 'Extrais les notes de joueurs de football. Les notes sont des chiffres dans des cercles colorés. Retourne un JSON: [{"playerName":"nom","rating":N}]. Chaque joueur a sa propre note. Retourne UNIQUEMENT le JSON.';
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

async function ocr(model: string, file: string): Promise<Map<string, number>> {
  const m = genAI.getGenerativeModel({ model });
  const data = fs.readFileSync(file).toString("base64");
  let r;
  for (let i = 1; ; i++) {
    try { r = await m.generateContent([{ inlineData: { mimeType: "image/jpeg", data } }, { text: PROMPT }]); break; }
    catch (e) { if (i >= 4) throw e; console.log(`   ${model} retry ${i}: ${(e as Error).message.slice(-80)}`); await new Promise((res) => setTimeout(res, 5000 * i)); }
  }
  const t = r.response.text();
  const arr: { playerName: string; rating: number }[] = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
  return new Map(arr.map((x) => [norm(x.playerName), x.rating]));
}

async function main() {
  let total = 0, agree = 0;
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".jpg") && (!process.argv[2] || process.argv.slice(2).some((a) => x.startsWith(a))))) {
    const [a, b] = await Promise.all(MODELS.map((m) => ocr(m, path.join(DIR, f))));
    const keys = new Set([...Array.from(a.keys()), ...Array.from(b.keys())]);
    const diffs: string[] = [];
    for (const k of Array.from(keys)) {
      total++;
      if (a.get(k) === b.get(k)) agree++;
      else diffs.push(`${k}: ${MODELS[0]}=${a.get(k) ?? "absent"} ${MODELS[1]}=${b.get(k) ?? "absent"}`);
    }
    console.log(`${f}: 2.5=${a.size} joueurs, 3.8=${b.size} joueurs, ${diffs.length} écart(s)`);
    diffs.forEach((d) => console.log("   " + d));
  }
  console.log(`\nAccord: ${agree}/${total}`);
}
main();
