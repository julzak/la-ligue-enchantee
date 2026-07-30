export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonError500 } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

// Inscription des participants dans les ligues d'une nouvelle saison.
// Les ligues sont par affinité : le prefill recopie les participants de la
// saison précédente, ligue à ligue, par rang (tier asc puis id asc).

function cleanUserName(raw: string): string {
  return raw.replace(/<[^>]*>/g, "").trim();
}

// GET ?seasonId= : ligues de la saison + inscrits actuels + prefill N-1 + liste des users.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const seasonId = Number(searchParams.get("seasonId"));
  if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });

  const leagues = await prisma.league.findMany({
    where: { seasonId },
    orderBy: [{ tier: "asc" }, { id: "asc" }],
    select: { id: true, name: true, tier: true },
  });
  if (leagues.length === 0) {
    return NextResponse.json({ error: "Aucune ligue pour cette saison (faire l'étape Ligues d'abord)" }, { status: 409 });
  }

  const current = await prisma.leagueUser.findMany({
    where: { leagueId: { in: leagues.map((l) => l.id) } },
  });

  // Prefill : dernière saison clôturée antérieure ayant des ligues rattachées.
  const prevSeason = await prisma.season.findFirst({
    where: { status: "CLOSED", id: { lt: seasonId }, leagues: { some: {} } },
    orderBy: { id: "desc" },
    include: {
      leagues: {
        orderBy: [{ tier: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      },
    },
  });

  let prefill: { leagueId: number; userIds: number[] }[] = [];
  if (prevSeason) {
    const prevMembers = await prisma.leagueUser.findMany({
      where: { leagueId: { in: prevSeason.leagues.map((l) => l.id) } },
    });
    // Mapping par rang : i-ème ligue de la saison N-1 -> i-ème ligue de la nouvelle.
    prefill = prevSeason.leagues
      .map((prevLeague, i) => ({
        leagueId: leagues[i]?.id,
        userIds: prevMembers.filter((m) => m.leagueId === prevLeague.id).map((m) => m.userId),
      }))
      .filter((p): p is { leagueId: number; userIds: number[] } => p.leagueId !== undefined);
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });

  return NextResponse.json({
    leagues,
    current: leagues.map((l) => ({
      leagueId: l.id,
      userIds: current.filter((c) => c.leagueId === l.id).map((c) => c.userId),
    })),
    prefill,
    prevSeasonLabel: prevSeason?.label ?? null,
    users: users
      .map((u) => ({ id: u.id, name: cleanUserName(u.name), email: u.email }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  });
}

// POST {seasonId, assignments: [{leagueId, userIds}]} : remplace les inscrits
// de chaque ligue de la saison. Idempotent (delete + recreate par ligue).
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const { seasonId, assignments } = (await req.json()) as {
      seasonId?: number;
      assignments?: { leagueId: number; userIds: number[] }[];
    };
    if (!seasonId) return NextResponse.json({ error: "seasonId requis" }, { status: 400 });
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: "Aucune affectation" }, { status: 400 });
    }

    // Garde-fou : modifiable uniquement avant le lancement. Une fois la saison
    // ACTIVE, les inscriptions ne se réécrivent plus en masse (STATS_USER et
    // les classements référencent ces ligues).
    const season = await prisma.season.findUnique({ where: { id: Number(seasonId) } });
    if (!season) return NextResponse.json({ error: "Saison introuvable" }, { status: 404 });
    if (season.status !== "SETUP" && season.status !== "AUCTION") {
      return NextResponse.json(
        { error: "Participants modifiables uniquement avant le lancement (SETUP ou AUCTION)" },
        { status: 409 }
      );
    }

    // Garde-fou : on ne touche QUE les ligues appartenant à cette saison
    // (jamais les ligues legacy ou d'une autre saison).
    const seasonLeagues = await prisma.league.findMany({
      where: { seasonId: Number(seasonId) },
      select: { id: true },
    });
    const allowedIds = new Set(seasonLeagues.map((l) => l.id));
    for (const a of assignments) {
      if (!allowedIds.has(a.leagueId)) {
        return NextResponse.json(
          { error: `Ligue ${a.leagueId} hors de la saison ${seasonId}` },
          { status: 400 }
        );
      }
      if (!Array.isArray(a.userIds)) {
        return NextResponse.json({ error: "userIds invalide" }, { status: 400 });
      }
    }

    // Un même user ne peut pas être dans deux ligues de la même saison.
    const seen = new Map<number, number>();
    for (const a of assignments) {
      for (const uid of a.userIds) {
        if (seen.has(uid) && seen.get(uid) !== a.leagueId) {
          return NextResponse.json(
            { error: `Le participant ${uid} est affecté à deux ligues` },
            { status: 400 }
          );
        }
        seen.set(uid, a.leagueId);
      }
    }

    let total = 0;
    await prisma.$transaction(async (tx) => {
      for (const a of assignments) {
        await tx.leagueUser.deleteMany({ where: { leagueId: a.leagueId } });
        const unique = Array.from(new Set(a.userIds.map(Number)));
        if (unique.length > 0) {
          await tx.leagueUser.createMany({
            data: unique.map((userId) => ({ leagueId: a.leagueId, userId })),
          });
          total += unique.length;
        }
      }
    });

    return NextResponse.json({ ok: true, participantCount: total });
  } catch (e) {
    return jsonError500("[seasons/participants]", e, "Échec de l'enregistrement des participants");
  }
}
