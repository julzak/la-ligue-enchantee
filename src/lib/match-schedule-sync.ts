import { prisma } from "./prisma";
import { getFootballDataToken } from "./football-api";
import { toParisDateTime, nextDay, seasonStartYear } from "./paris-time";

// Sync du calendrier Ligue 1 vers MATCH_SCHEDULE, déclenchable depuis l'admin
// (miroir de scripts/sync-match-schedule.ts, qui reste utilisable en CLI/cron).
// Les overrides admin (matchs reportés) sont préservés : seules les lignes non
// overridées sont mises à jour.
//
// SOURCE : football-data.org, depuis le 2026-08-17. AVANT, c'était TheSportsDB
// appelé avec la clé de test publique "3" : cette clé TRONQUE chaque round à 5
// événements, d'où un calendrier à 5 matchs par journée au lieu de 9 (constaté
// en prod sur 2026-2027 : 152 lignes au lieu de 306, signalé par les admins via
// le module de saisie des notes). Ne JAMAIS revenir à l'endpoint eventsround
// avec une clé gratuite. football-data.org renvoie la saison complète en UNE
// requête, avec les mêmes libellés de clubs que notre table CLUB (les clubs sont
// importés de là depuis 2026-2027) : l'appariement calendrier <-> clubs devient
// exact au lieu de passer par des alias.

const FD_BASE = "https://api.football-data.org/v4";
const FD_COMPETITION = "FL1"; // Ligue 1

interface FdMatch {
  matchday: number | null;
  utcDate: string | null;
  status: string | null;
  homeTeam?: { name?: string | null };
  awayTeam?: { name?: string | null };
  score?: { fullTime?: { home: number | null; away: number | null } };
}

export interface ScheduleSyncResult {
  synced: number;
  daysWithData: number;
  daysEmpty: number[];
  // Nombre de journées dont la requête a échoué (réseau/HTTP/JSON), distinct des
  // journées réellement vides (API OK mais pas encore de calendrier). Avec
  // football-data.org l'appel est unique : la valeur est 0 ou 38 (panne totale).
  fetchErrors: number;
  // Lignes tronquées héritées de TheSportsDB supprimées par cette synchro.
  purged: number;
}

export async function syncMatchSchedule(seasonKey: string): Promise<ScheduleSyncResult> {
  const year = seasonStartYear(seasonKey);
  if (!year) {
    console.error(`[syncMatchSchedule] Clé de saison inexploitable : « ${seasonKey} »`);
    return { synced: 0, daysWithData: 0, daysEmpty: [], fetchErrors: 38, purged: 0 };
  }

  let matches: FdMatch[] = [];
  try {
    const token = await getFootballDataToken();
    if (!token) throw new Error("pas de token football-data.org (Admin → Configuration, champ Clé effectifs)");
    const res = await fetch(`${FD_BASE}/competitions/${FD_COMPETITION}/matches?season=${year}`, {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { matches?: FdMatch[] };
    matches = Array.isArray(data.matches) ? data.matches : [];
  } catch (e) {
    // Panne réelle : on ne touche à RIEN en base (surtout pas la purge).
    console.error(`[syncMatchSchedule] PANNE : ${(e as Error).message} (saison ${seasonKey}). Aucun calendrier synchronisé.`);
    return { synced: 0, daysWithData: 0, daysEmpty: [], fetchErrors: 38, purged: 0 };
  }

  if (matches.length === 0) {
    return { synced: 0, daysWithData: 0, daysEmpty: [], fetchErrors: 0, purged: 0 };
  }

  // Purge des lignes héritées de l'ancienne source, dont les libellés de clubs
  // diffèrent ("Marseille" vs "Olympique de Marseille") : sans elle, la clé
  // unique_match ne dédoublonne pas et le calendrier contiendrait les deux jeux.
  // Bornée aux lignes SANS score saisi ET SANS report admin : une ligne portant
  // du travail humain n'est jamais supprimée.
  const purged = await prisma.$executeRawUnsafe(
    `DELETE FROM MATCH_SCHEDULE
      WHERE season = ? AND source = 'thesportsdb'
        AND home_score IS NULL AND away_score IS NULL AND admin_override_date IS NULL`,
    seasonKey
  );
  if (purged > 0) {
    console.log(`[syncMatchSchedule] ${purged} ligne(s) TheSportsDB tronquée(s) purgée(s) pour ${seasonKey}.`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const daysSeen = new Set<number>();
  let synced = 0;

  for (const m of matches) {
    const day = m.matchday ?? 0;
    const homeTeam = m.homeTeam?.name ?? "";
    const awayTeam = m.awayTeam?.name ?? "";
    if (!day || !homeTeam || !awayTeam || !m.utcDate) continue;
    const local = toParisDateTime(m.utcDate);
    if (!local) continue;

    const homeScore = m.score?.fullTime?.home ?? null;
    const awayScore = m.score?.fullTime?.away ?? null;

    // Override admin existant : on ne touche pas aux dates, score seulement.
    const existing = await prisma.$queryRawUnsafe<{ admin_override_date: string | null }[]>(
      "SELECT admin_override_date FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ? AND home_team = ? AND away_team = ? LIMIT 1",
      seasonKey, day, homeTeam, awayTeam
    );
    if (existing.length > 0 && existing[0].admin_override_date) {
      if (homeScore !== null) {
        await prisma.$executeRawUnsafe(
          "UPDATE MATCH_SCHEDULE SET home_score = ?, away_score = ? WHERE season = ? AND matchday = ? AND home_team = ? AND away_team = ?",
          homeScore, awayScore, seasonKey, day, homeTeam, awayTeam
        );
      }
      daysSeen.add(day);
      continue;
    }

    const status = (m.status ?? "").toUpperCase();
    const isPostponed =
      status === "POSTPONED" || status === "SUSPENDED" || (homeScore === null && local.date < today) ? 1 : 0;

    await prisma.$executeRawUnsafe(
      `INSERT INTO MATCH_SCHEDULE (season, matchday, home_team, away_team, match_date, match_time, edition_date, home_score, away_score, is_postponed, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'football-data')
       ON DUPLICATE KEY UPDATE
         match_date = VALUES(match_date),
         match_time = VALUES(match_time),
         edition_date = VALUES(edition_date),
         home_score = COALESCE(VALUES(home_score), home_score),
         away_score = COALESCE(VALUES(away_score), away_score),
         is_postponed = VALUES(is_postponed),
         source = VALUES(source)`,
      seasonKey, day, homeTeam, awayTeam, local.date, local.time + ":00", nextDay(local.date),
      homeScore, awayScore, isPostponed
    );
    synced++;
    daysSeen.add(day);
  }

  const maxDay = Math.max(...Array.from(daysSeen), 0);
  const daysEmpty: number[] = [];
  for (let d = 1; d <= maxDay; d++) if (!daysSeen.has(d)) daysEmpty.push(d);

  return { synced, daysWithData: daysSeen.size, daysEmpty, fetchErrors: 0, purged };
}
