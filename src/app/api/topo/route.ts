import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { getLeagueBySlug, getLeagueStandings, getBestPerformances, getWorstPerformances, getCurrentMatchday, getParticipantDayScores } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// GET: retrieve saved topo (if exists)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const currentDay = await getCurrentMatchday();

  const rows = await prisma.$queryRawUnsafe<{ content: string }[]>(
    "SELECT content FROM TOPO WHERE matchday = ? AND league_slug = ? LIMIT 1",
    currentDay,
    slug
  );

  if (rows.length > 0) {
    return NextResponse.json({ topo: rows[0].content, matchday: currentDay, cached: true });
  }

  return NextResponse.json({ topo: null, matchday: currentDay, cached: false });
}

// POST: generate + save topo
export async function POST(request: Request) {
  try {
    const { slug } = await request.json();

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

    // Check if already generated for this matchday
    const existing = await prisma.$queryRawUnsafe<{ content: string }[]>(
      "SELECT content FROM TOPO WHERE matchday = ? AND league_slug = ? LIMIT 1",
      currentDay,
      slug
    );

    if (existing.length > 0) {
      return NextResponse.json({ topo: existing[0].content, matchday: currentDay, cached: true });
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

    const context = `
Ligue : ${league.name}
Journée : ${currentDay}

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

Voici les données de la journée :
${context}

Écris UNIQUEMENT le texte de la synthèse, rien d'autre.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Save to DB
    await prisma.$executeRawUnsafe(
      "INSERT INTO TOPO (matchday, league_slug, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content), created_at = CURRENT_TIMESTAMP",
      currentDay,
      slug,
      text
    );

    return NextResponse.json({ topo: text, matchday: currentDay, cached: false });
  } catch (error) {
    console.error("Topo generation error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du topo" },
      { status: 500 }
    );
  }
}
