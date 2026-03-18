import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getLeagueBySlug, getLeagueStandings, getBestPerformances, getWorstPerformances, getCurrentMatchday, getParticipantDayScores } from "@/lib/db";

const anthropic = new Anthropic();

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
      const topPlayers = sorted.slice(0, 3).map((s) => `${s.playerName} (${s.clubShort}): ${s.total} pts${s.goals > 0 ? ` [${s.goals}g]` : ""}${s.passes > 0 ? ` [${s.passes}a]` : ""}`);
      const worstPlayers = sorted.slice(-2).map((s) => `${s.playerName} (${s.clubShort}): ${s.total} pts`);
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

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Tu es Lia, la chroniqueuse IA de La Ligue Enchantée, un jeu de fantasy football entre potes qui dure depuis 20 ans. Écris la synthèse de la journée ${currentDay} pour la ${league.name}.

Ton style :
- Élégant, mordant, drôle. Style chronique sportive british avec une pointe d'ironie française.
- JAMAIS de long tirets (—), JAMAIS les mots "pauvre", "misérables", "misérable", "pathétique", "néant", "hécatombe", "décombres", "abysses". Le chambrage est fin et spirituel, jamais misérabiliste.
- Sois SYNTHÉTIQUE : 4-5 phrases max, chaque phrase doit porter un fait + une punchline.
- IMPORTANT : utilise UNIQUEMENT les joueurs listés dans le détail par participant ci-dessous. Ne devine PAS quels joueurs appartiennent à qui — c'est indiqué explicitement.
- Les "Gardiens [Club]" sont des joueurs fictifs (forfait), ignore-les dans tes commentaires. Cite les vrais joueurs par leur NOM, pas par leur club.
- Tu relies les performances des participants aux joueurs de L1 de LEUR effectif. Invente des vannes contextuelles :
  * Mauvaise perf : "ses joueurs hésitent à demander leur mutation", "aperçus au Macumba Night samedi soir", "menacent de se mettre en grève", "ont visiblement confondu le terrain avec leur canapé", "son gardien cherche encore le ballon"
  * Bonne perf : "Balogun va demander une augmentation après ce doublé", "Gboho devrait envoyer la facture directement à [participant]", "son agent négocie déjà une prime de résultat"
- Tu cites les noms des participants ET les joueurs/clubs de L1 concernés.
- Tu donnes la nouvelle position au classement quand il y a un mouvement.
- 1-2 emojis max, bien placés.
- 3e personne uniquement (pas de "tu" ni "vous").
- Pas de formules de politesse, pas d'intro. Attaque direct.

Exemple de ton attendu :
"Thib signe le carton de la journée (58 pts) et remonte en 6e, porté par le doublé de Balogun qui a martyrisé la défense nantaise. Blek le Roc tient bon en tête (54 pts) mais sent le souffle de Kazu dans son cou, ce dernier grimpant en 5e grâce aux exploits de Gboho. Côté dégâts, Zenigata coule en 7e avec 19 pts : ses joueurs rennais ont visiblement confondu le Roazhon Park avec une maison de retraite 🔥 Mathieu L. et ses 27 pts ne feront rire personne, surtout pas ses attaquants qui hésitent à demander leur mutation."

Voici les données de la journée :
${context}

Écris UNIQUEMENT le texte de la synthèse, rien d'autre.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

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
