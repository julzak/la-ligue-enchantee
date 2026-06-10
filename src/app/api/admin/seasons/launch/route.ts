export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { seasonKeyFromLabel } from "@/lib/season-key";

// Lancement d'une saison : vérifie que tout est prêt (checklist), crée les
// configs SQL de la saison (SCORING_CONFIG, JOKER_CONFIG) si absentes, puis
// passe la saison en ACTIVE + courante (une seule courante à la fois).
//
// GET  ?seasonId= : checklist sans effet de bord (affichage admin ✓/✗).
// POST {seasonId} : re-vérifie la checklist puis lance.

interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  detail: string;
}

async function buildChecklist(seasonId: number) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return { season: null, items: [] as ChecklistItem[], seasonKey: null };

  const seasonKey = seasonKeyFromLabel(season.label);

  const [leagues, clubCount, playerCount] = await Promise.all([
    prisma.league.findMany({ where: { seasonId }, select: { id: true, name: true } }),
    prisma.club.count({ where: { seasonId } }),
    prisma.player.count({ where: { seasonId } }),
  ]);

  const members = await prisma.leagueUser.groupBy({
    by: ["leagueId"],
    where: { leagueId: { in: leagues.map((l) => l.id) } },
    _count: { userId: true },
  });
  const memberCount = new Map(members.map((m) => [m.leagueId, m._count.userId]));
  const emptyLeagues = leagues.filter((l) => (memberCount.get(l.id) ?? 0) === 0);
  const totalParticipants = members.reduce((sum, m) => sum + m._count.userId, 0);

  const scoringRows = seasonKey
    ? await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        "SELECT COUNT(*) AS n FROM SCORING_CONFIG WHERE season = ?", seasonKey)
    : [];
  const jokerRows = seasonKey
    ? await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        "SELECT COUNT(*) AS n FROM JOKER_CONFIG WHERE season = ?", seasonKey)
    : [];
  const scheduleRows = seasonKey
    ? await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        "SELECT COUNT(*) AS n FROM MATCH_SCHEDULE WHERE season = ?", seasonKey)
    : [];
  const hasScoring = Number(scoringRows[0]?.n ?? 0) > 0;
  const hasJokers = Number(jokerRows[0]?.n ?? 0) > 0;
  const scheduleCount = Number(scheduleRows[0]?.n ?? 0);

  const items: ChecklistItem[] = [
    {
      key: "status", label: "Statut de la saison", blocking: true,
      ok: season.status === "SETUP" || season.status === "AUCTION",
      detail: season.status === "CLOSED" ? "Saison déjà clôturée"
        : season.status === "ACTIVE" || season.status === "WINTER" ? "Saison déjà lancée"
        : `Statut ${season.status}, prêt au lancement`,
    },
    {
      key: "label", label: "Label de saison exploitable", blocking: true,
      ok: seasonKey !== null,
      detail: seasonKey
        ? `Clé saison « ${seasonKey} » (configs SQL + calendrier TheSportsDB)`
        : `Label « ${season.label} » invalide : attendu « 2027 » ou « 2026-2027 »`,
    },
    {
      key: "leagues", label: "Ligues créées", blocking: true,
      ok: leagues.length > 0,
      detail: leagues.length > 0 ? `${leagues.length} ligues` : "Aucune ligue (étape 3 du stepper)",
    },
    {
      key: "clubs", label: "Clubs importés", blocking: true,
      ok: clubCount > 0,
      detail: clubCount > 0 ? `${clubCount} clubs` : "Aucun club (étape 2 du stepper)",
    },
    {
      key: "players", label: "Joueurs importés", blocking: true,
      ok: playerCount > 0,
      detail: playerCount > 0 ? `${playerCount} joueurs` : "Aucun joueur (étape 2 du stepper)",
    },
    {
      key: "participants", label: "Participants inscrits dans chaque ligue", blocking: true,
      ok: leagues.length > 0 && emptyLeagues.length === 0,
      detail: emptyLeagues.length === 0
        ? `${totalParticipants} participants répartis`
        : `Ligue(s) sans participant : ${emptyLeagues.map((l) => l.name).join(", ")} (étape 4 du stepper)`,
    },
    {
      key: "scoring", label: "Config de scoring de la saison", blocking: false,
      ok: hasScoring,
      detail: hasScoring ? "SCORING_CONFIG présente" : "Sera clonée depuis la saison précédente au lancement",
    },
    {
      key: "jokers", label: "Config des jokers de la saison", blocking: false,
      ok: hasJokers,
      detail: hasJokers
        ? "JOKER_CONFIG présente"
        : "Sera clonée au lancement (dates de deadline à re-saisir dans Admin → Jokers)",
    },
    {
      key: "schedule", label: "Calendrier Ligue 1 synchronisé", blocking: false,
      ok: scheduleCount > 0,
      detail: scheduleCount > 0
        ? `${scheduleCount} matchs en base`
        : "Utiliser le bouton « Synchroniser le calendrier » de la saison (rejouable, avant ou après lancement)",
    },
  ];

  return { season, items, seasonKey };
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const seasonId = Number(new URL(req.url).searchParams.get("seasonId"));
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });
  const { season, items } = await buildChecklist(seasonId);
  if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });
  return NextResponse.json({ items, ready: items.every((i) => i.ok || !i.blocking) });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { seasonId } = (await req.json()) as { seasonId?: number };
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

  const { season, items, seasonKey } = await buildChecklist(Number(seasonId));
  if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });

  const blockers = items.filter((i) => i.blocking && !i.ok);
  if (blockers.length > 0) {
    return NextResponse.json(
      { error: "La saison n'est pas prête au lancement", items },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // Configs SQL de la saison : clonées depuis la saison la plus récente si absentes.
    // seasonKey est non-null ici (item "label" bloquant).
    const scoringExists = await tx.$queryRawUnsafe<{ n: bigint }[]>(
      "SELECT COUNT(*) AS n FROM SCORING_CONFIG WHERE season = ?", seasonKey);
    if (Number(scoringExists[0]?.n ?? 0) === 0) {
      const cloned = await tx.$executeRawUnsafe(
        `INSERT INTO SCORING_CONFIG (season, goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att,
           csc_malus, penalty_saved_bonus, red_card_note_zero, min_note,
           deadline_hour, early_match_hour, early_match_offset_hours)
         SELECT ?, goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att,
           csc_malus, penalty_saved_bonus, red_card_note_zero, min_note,
           deadline_hour, early_match_hour, early_match_offset_hours
         FROM SCORING_CONFIG ORDER BY id DESC LIMIT 1`,
        seasonKey
      );
      if (cloned === 0) {
        // Aucune config existante : valeurs par défaut de la table.
        await tx.$executeRawUnsafe("INSERT INTO SCORING_CONFIG (season) VALUES (?)", seasonKey);
      }
    }

    const jokersExist = await tx.$queryRawUnsafe<{ n: bigint }[]>(
      "SELECT COUNT(*) AS n FROM JOKER_CONFIG WHERE season = ?", seasonKey);
    if (Number(jokersExist[0]?.n ?? 0) === 0) {
      // Deadlines remises à NULL : les dates de l'an passé seraient fausses.
      await tx.$executeRawUnsafe(
        `INSERT INTO JOKER_CONFIG (season, type, max_count, deadline, is_active)
         SELECT ?, type, max_count, NULL, is_active
         FROM JOKER_CONFIG
         WHERE season = (SELECT season FROM (SELECT season FROM JOKER_CONFIG ORDER BY id DESC LIMIT 1) latest)`,
        seasonKey
      );
    }

    // Compta des cotisations : une ligne de suivi par participant (30€ par
    // défaut, non payé), pour la page Admin → Paiements. Le paiement lui-même
    // se fait hors plateforme (PayPal), on ne tient que le pointage.
    await tx.$executeRawUnsafe(
      `INSERT IGNORE INTO PAYMENT (user_id, season)
       SELECT lu.ID_USER, ? FROM LEAGUE_USER lu
       JOIN LEAGUE l ON l.ID_LEAGUE = lu.ID_LEAGUE
       WHERE l.ID_SEASON = ?`,
      seasonKey, season.id
    );

    // Une seule saison courante.
    await tx.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    await tx.season.update({
      where: { id: season.id },
      data: { status: "ACTIVE", isCurrent: true, startedAt: new Date() },
    });
  });

  return NextResponse.json({
    ok: true,
    message: `Saison ${season.label} lancée : le site bascule sur ses ligues, clubs et joueurs.`,
    items,
  });
}
