import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLeagueBySlug, getLeagueStandings, getBestPerformances, getWorstPerformances, getCurrentMatchday } from "@/lib/db";

const anthropic = new Anthropic();

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

    // Build context for Claude
    const top5 = standings.standings.slice(0, 5);
    const bottom3 = standings.standings.slice(-3);
    const progressions = standings.standings.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
    const drops = standings.standings.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

    // Day rankings (sorted by matchday score)
    const dayRanked = [...standings.standings].sort((a, b) => b.lastMatchdayPoints - a.lastMatchdayPoints);
    const dayBest = dayRanked[0];
    const dayWorst = dayRanked[dayRanked.length - 1];

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
`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Tu es Lia, la chroniqueuse IA de La Ligue Enchantée, un jeu de fantasy football entre potes qui dure depuis 20 ans. Écris la synthèse de la journée ${currentDay} pour la ${league.name}.

Ton style :
- Élégant et spirituel, style chronique sportive british. Tu chambres avec classe, jamais lourdement.
- JAMAIS de "pauvre mec", "misérables", "pathétique" ou d'insultes. Le chambrage est fin, ironique, avec un sourire en coin.
- Tu relies TOUJOURS les performances des participants aux joueurs de L1 qui les ont portés ou coulés. Exemple : "Kazu doit un fier cierge à Balogun et son doublé" ou "Zenigata a payé cash l'après-midi cauchemardesque de son gardien rennais".
- Tu cites les noms des participants ET les joueurs/clubs de L1 responsables de leurs bonheurs ou malheurs.
- Tu mets en avant les mouvements au classement en donnant la nouvelle position.
- Maximum 5-6 phrases. Percutant, fluide, agréable à lire.
- 1-2 emojis max, bien placés.
- Tu ne tutoies pas, tu utilises la 3e personne. Pas de "tu" ni de "vous".
- Pas de formules de politesse, pas d'intro. Tu attaques direct par un fait marquant.

Exemple de ton attendu :
"Blek le Roc continue son petit bonhomme de chemin avec 54 pts et renforce sa domination en tête, mais attention : Kazu remonte les marches avec ses 53 pts et se glisse en 5e, tandis que Thib signe le meilleur score de la journée (58 pts) grâce au festival de Balogun. Du côté des déconvenues, Zenigata a payé cash la soirée catastrophe de son gardien et dégringole de 2 places 🔥 Toulouse a fait la loi avec Gboho et Dønnum qui ont régalé. La synthèse ? Du suspense au top 3, et des chasseurs qui commencent sérieusement à chipoter les places."

Voici les données de la journée :
${context}

Écris UNIQUEMENT le texte de la synthèse, rien d'autre.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ topo: text, matchday: currentDay });
  } catch (error) {
    console.error("Topo generation error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du topo" },
      { status: 500 }
    );
  }
}
