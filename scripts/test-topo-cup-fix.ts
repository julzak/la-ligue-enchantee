/**
 * Test : la nouvelle cup section + prompt empêche-t-elle l'inversion qualifié/éliminé ?
 * Reproduit le contexte J32 Ligue 2 où Gemini Flash avait halluciné Benhijk en finale et
 * Cdt de Bord qualifié, alors que les vrais qualifiés sont Nums et Batistuta.
 *
 * Lance le test sur Gemini 2.5 Flash (modèle primaire) et Claude Sonnet 4.6 (fallback).
 * 3 runs par modèle pour couvrir la variance.
 */
import { config as loadDotenv } from "dotenv";
import * as path from "path";

loadDotenv({ path: path.join(__dirname, "..", ".env") });

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";

if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY missing");
if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY missing");

// --- mock contexte J32 Ligue 2 (nouveau format cup) ---
const cupSection = `
🏆 Coupe Enchantée - Demi-finale (J32) :
QUALIFIÉS pour le tour suivant : Batistuta (67.0 pts) ; Nums (56.0 pts)
ÉLIMINÉS de la Coupe : Commandant de Bord (57.0 pts) ; Benhijk (50.0 pts)
`;

// distracteurs : performances individuelles fortes côté éliminés (Mousa Al-Tamari pour
// Cdt de Bord, Tolisso pour Benhijk) — exactement ce qui a probablement induit l'inversion
const context = `
Ligue : Ligue 2
Journée : 32
${cupSection}

Classement général (top 5) :
1. Francis Llacer - 580 pts (J32: 58 pts)
2. Gonz - 580 pts (J32: 58 pts)
3. Le Général - 540 pts (J32: 50 pts)
4. Skippy - 510 pts (J32: 62 pts)
5. Commandant de Bord - 495 pts (J32: 57 pts)

Bas du classement :
14. Bernard Lada - 290 pts (J32: 28 pts)
16. Sergio Schramos - 250 pts (J32: 26 pts)
18. Vestea - 230 pts (J32: 26 pts)

Meilleur score de la journée : Skippy avec 62 pts
Pire score de la journée : Vestea avec 26 pts

Progressions au classement :
Skippy : +1 places (maintenant 12e)
Commandant de Bord : +1 places (maintenant 5e)

Chutes au classement :
Bernard Lada : -2 places (maintenant 18e)
Sergio Schramos : -1 places (maintenant 16e)

Meilleures performances joueurs L1 :
Mousa Al-Tamari (LOSC) - 14 pts (1 but, 1 passe)
Corentin Tolisso (OL) - 13 pts (1 but)
Rudy Matondo (Reims) - 12 pts (1 but)
Endrick (PSG) - 11 pts
Hákon Arnar Haraldsson (LOSC) - 10 pts

Pires performances joueurs L1 :
Jonathan Clauss (OM) - 0 pts
Vitinha (OM) - 0 pts
Mohamed Mostafa (Reims) - 0 pts

Total journée : 720.5 pts pour 18 participants

Détail par participant (meilleurs/pires joueurs L1 de LEUR effectif) :
Skippy (62 pts, 12e) :
  Meilleurs : Rudy Matondo: 12 pts [1 but], Corentin Tolisso: 13 pts [1 but]
  Pires : Jonathan Clauss: 0 pts

Francis Llacer (58 pts, 1er) :
  Meilleurs : Hákon Arnar Haraldsson: 10 pts, Roman Yaremchuk: 9 pts
  Pires : Mohamed Mostafa: 0 pts

Gonz (58 pts, 2e) :
  Meilleurs : Endrick: 11 pts, Jordan Lefort: 4 pts
  Pires : (aucun)

Le Général (50 pts, 3e) :
  Meilleurs : Afonso Moreira: 9 pts
  Pires : (aucun)

Commandant de Bord (57 pts, 5e) :
  Meilleurs : Mousa Al-Tamari: 14 pts [1 but] [1 passe]
  Pires : (aucun)

Benhijk (50 pts, 8e) :
  Meilleurs : Corentin Tolisso: 13 pts [1 but]
  Pires : Jonathan Clauss: 0 pts

Bernard Lada (28 pts, 18e) :
  Meilleurs : (aucun)
  Pires : Vitinha: 0 pts

Vestea (26 pts, dernier) :
  Meilleurs : (aucun)
  Pires : Vitinha: 0 pts, Mohamed Mostafa: 0 pts
`;

const prompt = `Tu es Lia, la chroniqueuse IA de La Ligue Enchantée, un jeu de fantasy football entre potes qui dure depuis 20 ans. Écris la synthèse de la journée 32 pour la Ligue 2.

Ton style :
- Élégant, mordant, drôle. Style chronique sportive british avec une pointe d'ironie française.
- JAMAIS de long tirets (—), JAMAIS les mots "pauvre", "misérables", "misérable", "pathétique", "néant", "hécatombe", "décombres", "abysses". Le chambrage est fin et spirituel, jamais misérabiliste.
- Sois SYNTHÉTIQUE : 4-5 phrases max, chaque phrase doit porter un fait + une punchline.
- IMPORTANT : utilise UNIQUEMENT les joueurs listés dans le détail par participant ci-dessous. Ne devine PAS quels joueurs appartiennent à qui — c'est indiqué explicitement. Ne fais AUCUNE déduction basée sur le club réel d'un joueur.
- Les "Gardiens [Club]" sont des joueurs fictifs (forfait), ignore-les dans tes commentaires. Cite les vrais joueurs par leur NOM uniquement.
- Tu relies les performances des participants aux joueurs de LEUR effectif. Invente des vannes contextuelles.
- Tu cites les noms des participants ET les noms des joueurs de L1 (pas leur club).
- Tu donnes la nouvelle position au classement quand il y a un mouvement.
- 1-2 emojis max, bien placés.
- 3e personne uniquement (pas de "tu" ni "vous").
- Pas de formules de politesse, pas d'intro. Attaque direct.
- Si une section "Coupe Enchantée" est présente dans les données, consacre-lui 1 phrase dédiée. RÈGLE STRICTE : pour citer un qualifié, recopie EXACTEMENT un nom de la ligne "QUALIFIÉS pour le tour suivant". Pour citer un éliminé, recopie EXACTEMENT un nom de la ligne "ÉLIMINÉS de la Coupe". N'inverse JAMAIS qualifié/éliminé. Ne déduis PAS le résultat à partir des scores ou des performances de joueurs : copie les noms tels quels. Place ensuite une punchline.

Voici les données de la journée :
${context}

Écris UNIQUEMENT le texte de la synthèse, rien d'autre.`;

async function callGemini(modelId: string): Promise<string> {
  const useThinking = modelId.includes("2.5");
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 600,
      ...(useThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini ${modelId}: ${res.status} ${res.statusText} — ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callClaude(): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude: ${res.status} — ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

interface Verdict { run: number; ok: boolean; output: string; flags: string[]; }

function evaluate(output: string): Verdict["flags"] {
  const flags: string[] = [];
  // Inversion type 1 : un éliminé est sujet d'un verbe de victoire/qualif
  const eliminAsWinner: RegExp[] = [
    /(commandant\s+de\s+bord|benhijk)[\s,]{1,3}(?:[a-zà-ÿ',.\s]{0,60}?\s)?(s'offre\s+la\s+finale|se\s+qualifie|passe\s+en\s+finale|file\s+en\s+finale|rejoint\s+la\s+finale|signe\s+(?:une\s+)?(?:belle\s+)?qualification|décroche\s+(?:son\s+)?ticket|gagne\s+(?:sa|son)\s+(?:demi|demie|match))/i,
  ];
  // Inversion type 2 : un vrai qualifié est sujet d'un verbe d'élimination
  const winnerAsElimin: RegExp[] = [
    /(batistuta|nums)[\s,]{1,3}(?:[a-zà-ÿ',.\s]{0,60}?\s)?(éliminé|sur\s+le\s+carreau|s'incline|tombe|sort\s+de\s+la\s+coupe|stoppé)/i,
  ];
  for (const re of eliminAsWinner) {
    const m = re.exec(output);
    if (m) flags.push(`INVERSION: "${m[1]}" cité comme qualifié ("${m[2]}")`);
  }
  for (const re of winnerAsElimin) {
    const m = re.exec(output);
    if (m) flags.push(`INVERSION: "${m[1]}" cité comme éliminé ("${m[2]}")`);
  }
  const lower = output.toLowerCase();
  if (!lower.includes("batistuta") && !lower.includes("nums")) {
    flags.push("OUBLI: aucun vrai qualifié cité (Batistuta ou Nums)");
  }
  return flags;
}

async function runModel(label: string, fn: () => Promise<string>, runs = 3): Promise<Verdict[]> {
  const results: Verdict[] = [];
  for (let i = 1; i <= runs; i++) {
    try {
      const output = await fn();
      const flags = evaluate(output);
      results.push({ run: i, ok: flags.length === 0, output, flags });
      console.log(`\n========== ${label} run ${i} ${flags.length === 0 ? "✅" : "❌"} ==========`);
      console.log(output);
      if (flags.length > 0) console.log(`  → flags : ${flags.join(" | ")}`);
    } catch (e: unknown) {
      console.log(`\n========== ${label} run ${i} ⚠️ ERROR ==========`);
      console.log((e as Error).message);
      results.push({ run: i, ok: false, output: "", flags: [`ERROR: ${(e as Error).message}`] });
    }
  }
  return results;
}

async function main() {
  // Sanity-check du détecteur : il DOIT flagger le texte buggué d'origine
  const originalBuggy = "Benhijk, de son côté, s'offre la finale de la Coupe malgré un Jonathan Clauss à zéro";
  const sanityFlags = evaluate(originalBuggy);
  if (sanityFlags.length === 0) {
    console.error("⚠️ Le détecteur ne flag pas le bug d'origine — il est trop lâche, j'arrête.");
    process.exit(3);
  }
  console.log(`Détecteur sanity-check : OK (flag attendu sur texte d'origine: ${sanityFlags[0]})\n`);

  console.log("Test cup-fix : 3 runs Gemini 2.5 Flash + 3 runs Claude Sonnet 4.6");
  console.log("Ground truth : Batistuta + Nums qualifiés ; Cdt de Bord + Benhijk éliminés\n");

  const gemini = await runModel("gemini-2.5-flash", () => callGemini("gemini-2.5-flash"));
  const claude = await runModel("claude-sonnet-4-6", () => callClaude());

  console.log("\n\n========== RÉCAP ==========");
  const all = [...gemini.map((r) => ({ ...r, model: "gemini-2.5-flash" })), ...claude.map((r) => ({ ...r, model: "claude-sonnet-4-6" }))];
  const okCount = all.filter((r) => r.ok).length;
  console.log(`${okCount}/${all.length} runs sans inversion`);
  for (const r of all) {
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.model} run ${r.run}${r.flags.length ? ` — ${r.flags.join(" | ")}` : ""}`);
  }
  process.exit(okCount === all.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
