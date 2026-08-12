import { NextResponse } from "next/server";
import { prisma, inParams } from "@/lib/prisma";
import { getCurrentSeasonKey } from "@/lib/season";
import { getLeagueBySlug, getLeagueStandings, getBestPerformances, getWorstPerformances, getCurrentMatchday, getParticipantDayScores, getCupContextForDay } from "@/lib/db";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";

async function callClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_KEY) throw new Error("No Anthropic key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      // Sonnet 5 : thinking actif par defaut et compte dans max_tokens ;
      // desactive pour garder le budget 600 et content[0] en bloc text.
      thinking: { type: "disabled" },
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callGemini(modelId: string, prompt: string): Promise<string> {
  const isPro = modelId.includes("2.5-pro");
  const is25 = modelId.includes("2.5");
  // Gemini 2.5 Pro : le "thinking" est obligatoire (thinkingBudget=0 interdit) et
  // compte dans maxOutputTokens. On le plafonne et on laisse assez de marge pour
  // que la synthèse (~600 tokens visibles) s'écrive APRÈS le raisonnement, sinon
  // la réponse revient vide (finishReason=MAX_TOKENS). Le thinking améliore
  // l'exactitude (pas d'inversion qualifié/éliminé, bonne attribution des joueurs).
  // Flash 2.5 : thinking désactivé (rapide, free tier). 2.0 : pas de thinking.
  const generationConfig: Record<string, unknown> = isPro
    ? { maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 1024 } }
    : { maxOutputTokens: 600, ...(is25 ? { thinkingConfig: { thinkingBudget: 0 } } : {}) };
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    throw new Error(`Gemini ${modelId}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

// GET: retrieve saved topo (if exists)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const currentDay = await getCurrentMatchday();

  const rows = await prisma.$queryRawUnsafe<{ content: string; is_provisional: number }[]>(
    "SELECT content, is_provisional FROM TOPO WHERE matchday = ? AND league_slug = ? LIMIT 1",
    currentDay,
    slug
  );

  if (rows.length > 0) {
    return NextResponse.json({
      topo: rows[0].content,
      matchday: currentDay,
      cached: true,
      isProvisional: rows[0].is_provisional === 1,
    });
  }

  return NextResponse.json({ topo: null, matchday: currentDay, cached: false, isProvisional: false });
}

// POST: generate + save topo
export async function POST(request: Request) {
  try {
    const { slug, force } = await request.json();

    const league = await getLeagueBySlug(slug);
    if (!league) {
      return NextResponse.json({ error: "Ligue non trouvée" }, { status: 404 });
    }

    const [standings, bestPerfs, worstPerfs, currentDay] = await Promise.all([
      getLeagueStandings(league.dbId),
      getBestPerformances(undefined, 5),
      getWorstPerformances(undefined, 5),
      getCurrentMatchday(),
    ]);

    const cupContext = await getCupContextForDay(currentDay);

    // Check how many matches are played this matchday
    const matchCounts = await prisma.$queryRawUnsafe<{ total: number; played: number }[]>(
      "SELECT COUNT(*) as total, SUM(home_score IS NOT NULL) as played FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ?",
      await getCurrentSeasonKey(), currentDay
    );
    const totalMatches = Number(matchCounts[0]?.total ?? 9);
    const playedMatches = Number(matchCounts[0]?.played ?? 0);
    const isIncomplete = playedMatches < totalMatches && playedMatches > 0;

    // Check if already generated for this matchday
    const existing = await prisma.$queryRawUnsafe<{ content: string; is_provisional: number }[]>(
      "SELECT content, is_provisional FROM TOPO WHERE matchday = ? AND league_slug = ? LIMIT 1",
      currentDay,
      slug
    );

    // If a final (non-provisional) topo exists, return it
    // If a provisional topo exists but the day is now complete, allow regeneration
    // If `force === true` is sent in body, always regenerate (bypass cache)
    if (existing.length > 0 && !force) {
      const wasProvisional = existing[0].is_provisional === 1;
      if (!wasProvisional || isIncomplete) {
        return NextResponse.json({
          topo: existing[0].content,
          matchday: currentDay,
          cached: true,
          isProvisional: wasProvisional,
        });
      }
      // wasProvisional && !isIncomplete → day is now complete, regenerate final version
    }

    // Build context for Claude
    const top5 = standings.standings.slice(0, 5);
    const bottom3 = standings.standings.slice(-3);
    const progressions = standings.standings.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
    const drops = standings.standings.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

    const dayRanked = [...standings.standings].sort((a, b) => b.lastMatchdayPoints - a.lastMatchdayPoints);
    const dayBest = dayRanked[0];
    const dayWorst = dayRanked[dayRanked.length - 1];

    // Get player details for ALL participants (so Lia knows exactly who owns what)
    const keyParticipants = dayRanked;

    const participantDetails: string[] = [];
    for (const p of keyParticipants) {
      const dayScores = await getParticipantDayScores(league.dbId, p.userId, currentDay);
      const sorted = [...dayScores].sort((a, b) => b.total - a.total);
      // Don't include club abbreviations — Haiku confuses player clubs with participant ownership
      const realPlayers = sorted.filter((s) => !s.playerName.startsWith("Gardiens"));
      const topPlayers = realPlayers.slice(0, 3).map((s) => `${s.playerName}: ${s.total} pts${s.goals > 0 ? ` [${s.goals} but${s.goals > 1 ? "s" : ""}]` : ""}${s.passes > 0 ? ` [${s.passes} passe${s.passes > 1 ? "s" : ""}]` : ""}`);
      const worstPlayers = realPlayers.slice(-2).map((s) => `${s.playerName}: ${s.total} pts`);
      participantDetails.push(`${p.userName} (${p.lastMatchdayPoints} pts, ${p.rank}e) :\n  Meilleurs : ${topPlayers.join(", ")}\n  Pires : ${worstPlayers.join(", ")}`);
    }

    // Build cup section if this day had a cup round
    let cupSection = "";
    if (cupContext && cupContext.matches.length > 0) {
      const participantIds = new Set(standings.standings.map((s) => s.userId));
      const cupUserIds = Array.from(new Set(
        cupContext.matches.flatMap((m) => [m.user1Id, m.user2Id].filter((id): id is number => id !== null))
      ));
      const cupUsers = cupUserIds.length > 0
        ? await (async () => { const [ph, vs] = inParams(cupUserIds); return prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
            `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${ph})`, ...vs); })()
        : [];
      const nameOf = new Map(cupUsers.map((u) => [
        Number(u.ID_USER),
        (u.NAME ?? "").replace(/<[^>]*>/g, "").trim(),
      ]));

      // Only include matches involving at least one participant from this league
      const relevantMatches = cupContext.matches.filter((m) =>
        (m.user1Id && participantIds.has(m.user1Id)) ||
        (m.user2Id && participantIds.has(m.user2Id))
      );

      if (relevantMatches.length > 0) {
        const winners: string[] = [];
        const losers: string[] = [];
        const pending: string[] = [];
        for (const m of relevantMatches) {
          const n1 = m.user1Id ? nameOf.get(m.user1Id) ?? `#${m.user1Id}` : "—";
          const n2 = m.user2Id ? nameOf.get(m.user2Id) ?? `#${m.user2Id}` : "—";
          const s1 = m.score1 !== null ? m.score1.toFixed(1) : "?";
          const s2 = m.score2 !== null ? m.score2.toFixed(1) : "?";
          if (m.winnerId === null) {
            pending.push(`Match en cours : ${n1} (${s1} pts) vs ${n2} (${s2} pts)`);
            continue;
          }
          const winnerIsUser1 = m.winnerId === m.user1Id;
          const winnerName = winnerIsUser1 ? n1 : n2;
          const loserName = winnerIsUser1 ? n2 : n1;
          const winnerScore = winnerIsUser1 ? s1 : s2;
          const loserScore = winnerIsUser1 ? s2 : s1;
          winners.push(`${winnerName} (${winnerScore} pts)`);
          losers.push(`${loserName} (${loserScore} pts)`);
        }
        const sectionParts: string[] = [];
        if (winners.length > 0) {
          sectionParts.push(`QUALIFIÉS pour le tour suivant : ${winners.join(" ; ")}`);
          sectionParts.push(`ÉLIMINÉS de la Coupe : ${losers.join(" ; ")}`);
        }
        if (pending.length > 0) sectionParts.push(pending.join("\n"));
        cupSection = `\n🏆 Coupe Enchantée - ${cupContext.round} (J${cupContext.matchday}) :\n${sectionParts.join("\n")}\n`;
      }
    }

    const context = `
Ligue : ${league.name}
Journée : ${currentDay}
${cupSection}

Classement général (top 5) :
${top5.map((s) => `${s.rank}. ${s.userName} - ${s.totalPoints} pts (J${currentDay}: ${s.lastMatchdayPoints} pts)`).join("\n")}

Bas du classement :
${bottom3.map((s) => `${s.rank}. ${s.userName} - ${s.totalPoints} pts (J${currentDay}: ${s.lastMatchdayPoints} pts)`).join("\n")}

Meilleur score de la journée : ${dayBest?.userName} avec ${dayBest?.lastMatchdayPoints} pts
Pire score de la journée : ${dayWorst?.userName} avec ${dayWorst?.lastMatchdayPoints} pts

Progressions au classement :
${progressions.map((s) => `${s.userName} : +${s.delta} places (maintenant ${s.rank}e)`).join("\n") || "Aucune"}

Chutes au classement :
${drops.map((s) => `${s.userName} : ${s.delta} places (maintenant ${s.rank}e)`).join("\n") || "Aucune"}

Meilleures performances joueurs L1 :
${bestPerfs.map((p) => `${p.playerName} (${p.club}) - ${p.points} pts (${p.detail})`).join("\n")}

Pires performances joueurs L1 :
${worstPerfs.map((p) => `${p.playerName} (${p.club}) - ${p.points} pts`).join("\n")}

Total journée : ${standings.pointsJournee.toFixed(1)} pts pour ${standings.standings.length} participants

Détail par participant (meilleurs/pires joueurs L1 de LEUR effectif) :
${participantDetails.join("\n\n")}
`;

    // Qualité d'abord, gratuit d'abord : Gemini 2.5 Pro en primaire (meilleure
    // plume + suit le prompt fidèlement = moins d'erreurs), repli Flash puis 2.0.
    // Tout est sur le free tier Google. Sur une clé sans facturation, un dépassement
    // de quota Pro renvoie un 429 -> repli automatique sur Flash, jamais de charge.
    const MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"];

    const prompt = `Tu es Lia, la chroniqueuse IA de La Ligue Enchantée, un jeu de fantasy football entre potes qui dure depuis 20 ans. Écris la synthèse de la journée ${currentDay} pour la ${league.name}.

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
${isIncomplete ? `\nATTENTION : cette journée est incomplète (${playedMatches}/${totalMatches} matchs joués, ${totalMatches - playedMatches} reporté(s)). Mentionne-le brièvement en fin de synthèse.\n` : ""}
Écris UNIQUEMENT le texte de la synthèse, rien d'autre.`;

    // Try primary model with retries, then fallback
    let text = "";
    for (const modelId of MODELS) {
      const maxRetries = modelId === MODELS[0] ? 3 : 1;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          text = await callGemini(modelId, prompt);
          if (text) break;
        } catch (modelErr: unknown) {
          const msg = (modelErr as Error).message ?? "";
          console.error(`Topo: ${modelId} attempt ${attempt}/${maxRetries} failed: ${msg.slice(0, 80)}`);
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 3000 * attempt));
          }
        }
      }
      if (text) break;
    }
    // Filet de secours (payant, déclenché seulement si TOUT Gemini est indisponible)
    if (!text && ANTHROPIC_KEY) {
      try {
        text = await callClaude(prompt);
        console.log("Topo: fallback Claude Sonnet 5 OK");
      } catch (e: unknown) {
        console.error("Topo: Claude fallback failed:", (e as Error).message);
      }
    }

    if (!text) {
      return NextResponse.json({ error: "Tous les modèles IA sont indisponibles. Réessayez dans quelques minutes." }, { status: 503 });
    }

    // Save to DB (mark as provisional if matchday incomplete)
    await prisma.$executeRawUnsafe(
      "INSERT INTO TOPO (matchday, league_slug, content, is_provisional) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content), is_provisional = VALUES(is_provisional), created_at = CURRENT_TIMESTAMP",
      currentDay,
      slug,
      text,
      isIncomplete ? 1 : 0
    );

    return NextResponse.json({ topo: text, matchday: currentDay, cached: false, isProvisional: isIncomplete });
  } catch (error) {
    console.error("Topo generation error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du topo" },
      { status: 500 }
    );
  }
}
