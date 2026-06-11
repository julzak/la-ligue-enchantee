// Récupération des photos de joueurs depuis TheSportsDB premium, AU
// LANCEMENT de la saison (après les enchères), pour les seuls joueurs
// sélectionnés dans les équipes. Les images sont TÉLÉCHARGÉES en local
// (public/players/) : zéro hotlink, la résiliation de l'abonnement ne casse
// rien (leçon 2025-2026, cf docs/kickoff-nouvelle-saison.md phase 6bis).
//
// Risque surveillé : matching par nom entre nos joueurs (football-data.org)
// et TheSportsDB. Mitigation : matching PAR CLUB (30 noms vs 30, jamais de
// recherche globale comme en 2025-2026) + rapport des non-matchés pour
// correction manuelle.

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "./prisma";
import { getAppConfig, CONFIG_KEYS } from "./app-config";
import { canonicalClubKey } from "./assets";

const SDB_BASE = "https://www.thesportsdb.com/api/v1/json";
const L1_LEAGUE_ID = "4334";
const PHOTOS_DIR = path.join(process.cwd(), "public", "players");
const STAFF_POSITIONS = /manager|coach|assistant|director|goalkeeping/i;

// ── Helpers purs (testables) ────────────────────────────────────────────────

export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Apparie un de NOS joueurs à une liste de noms candidats (l'effectif du
// même club chez TheSportsDB). Exact d'abord, puis inclusion de tokens dans
// les deux sens ("K. Mbappe" vs "Kylian Mbappe", "Vanderson" vs "Vanderson
// de Oliveira"). Retourne l'index du candidat ou -1.
export function matchPlayerName(ourName: string, candidates: string[]): number {
  const ours = normalizePlayerName(ourName);
  const normalized = candidates.map(normalizePlayerName);

  const exact = normalized.indexOf(ours);
  if (exact !== -1) return exact;

  const ourTokens = ours.split(" ").filter((t) => t.length > 1);
  if (ourTokens.length === 0) return -1;

  const scored = normalized
    .map((cand, idx) => {
      const candTokens = cand.split(" ").filter((t) => t.length > 1);
      const oursInCand = ourTokens.every((t) => candTokens.includes(t));
      const candInOurs = candTokens.length > 0 && candTokens.every((t) => ourTokens.includes(t));
      return { idx, ok: oursInCand || candInOurs };
    })
    .filter((s) => s.ok);

  // Ambiguïté (2 candidats plausibles) = pas de match : on préfère un trou
  // signalé à une mauvaise photo.
  return scored.length === 1 ? scored[0].idx : -1;
}

// ── TheSportsDB premium ─────────────────────────────────────────────────────

export async function getSdbPremiumKey(): Promise<string | null> {
  const fromDb = await getAppConfig(CONFIG_KEYS.THESPORTSDB_PREMIUM_KEY);
  if (fromDb) return fromDb;
  return process.env.THESPORTSDB_PREMIUM_KEY || null;
}

interface SdbPlayer {
  strPlayer: string;
  strPosition: string | null;
  strCutout: string | null;
  strThumb: string | null;
}

async function fetchSdbTeamsByKey(key: string): Promise<Map<string, string>> {
  const res = await fetch(`${SDB_BASE}/${key}/lookup_all_teams.php?id=${L1_LEAGUE_ID}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`TheSportsDB ${res.status} (liste des clubs)`);
  const json = (await res.json()) as { teams?: { idTeam: string; strTeam: string }[] };
  const map = new Map<string, string>();
  for (const t of json.teams ?? []) map.set(canonicalClubKey(t.strTeam), t.idTeam);
  return map;
}

async function fetchSdbSquad(key: string, teamId: string): Promise<SdbPlayer[]> {
  const res = await fetch(`${SDB_BASE}/${key}/lookup_all_players.php?id=${teamId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`TheSportsDB ${res.status} (effectif ${teamId})`);
  const json = (await res.json()) as { player?: SdbPlayer[] };
  return (json.player ?? []).filter((p) => !STAFF_POSITIONS.test(p.strPosition ?? ""));
}

// ── Téléchargement local ────────────────────────────────────────────────────

async function downloadToLocal(url: string, playerId: number): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Téléchargement ${res.status} (${url})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 100) throw new Error(`Image vide (${url})`);
  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  const ext = url.split(".").pop()?.split("?")[0].toLowerCase();
  const safeExt = ext && ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
  const fileName = `${playerId}.${safeExt}`;
  await fs.writeFile(path.join(PHOTOS_DIR, fileName), buffer);
  return `/players/${fileName}`;
}

export async function setPlayerPhotoFromUrl(playerId: number, url: string): Promise<string> {
  if (!/^https?:\/\//.test(url)) throw new Error("URL invalide (http/https attendu)");
  const localPath = await downloadToLocal(url, playerId);
  await prisma.$executeRawUnsafe("UPDATE PLAYER SET PHOTO_URL = ? WHERE ID_PLAYER = ?", localPath, playerId);
  return localPath;
}

// ── Orchestration ───────────────────────────────────────────────────────────

export interface PhotoSyncReport {
  selected: number;
  alreadyLocal: number;
  downloaded: number;
  unmatched: { playerId: number; name: string; clubName: string }[];
  failed: { playerId: number; name: string; error: string }[];
  clubsUnresolved: string[];
}

// Synchronise les photos des joueurs SÉLECTIONNÉS dans les équipes de la
// saison (TEAM des ligues de la saison). allPlayers=true élargit à tous les
// joueurs de la saison (utile en recette) ; onlyPlayerIds restreint à une
// liste explicite (refresh d'un club). Rejouable : les photos déjà locales
// sont sautées.
export async function syncSeasonPhotos(
  seasonId: number,
  allPlayers = false,
  onlyPlayerIds?: number[]
): Promise<PhotoSyncReport> {
  const key = await getSdbPremiumKey();
  if (!key) {
    throw new Error(
      "Pas de clé photos TheSportsDB : la renseigner dans Admin → Configuration (phase 6bis du kick-off)"
    );
  }

  let playerIds: number[];
  if (onlyPlayerIds && onlyPlayerIds.length > 0) {
    playerIds = onlyPlayerIds;
  } else if (allPlayers) {
    const rows = await prisma.player.findMany({ where: { seasonId }, select: { id: true } });
    playerIds = rows.map((r) => r.id);
  } else {
    const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT DISTINCT t.ID_PLAYER AS id FROM TEAM t
       JOIN LEAGUE l ON l.ID_LEAGUE = t.ID_LEAGUE
       WHERE l.ID_SEASON = ?`,
      seasonId
    );
    playerIds = rows.map((r) => Number(r.id));
  }
  if (playerIds.length === 0) {
    throw new Error(
      allPlayers
        ? "Aucun joueur pour cette saison"
        : "Aucune équipe constituée : les photos se récupèrent APRÈS les enchères (ou cocher « tous les joueurs »)"
    );
  }

  const players = await prisma.$queryRawUnsafe<{
    id: number; fname: string; lname: string; photo_url: string | null; club_id: number; club_name: string;
  }[]>(
    `SELECT p.ID_PLAYER AS id, p.FNAME AS fname, p.LNAME AS lname, p.PHOTO_URL AS photo_url,
            c.ID_CLUB AS club_id, c.NAME AS club_name
     FROM PLAYER p JOIN CLUB c ON c.ID_CLUB = p.ID_CLUB
     WHERE p.ID_PLAYER IN (${playerIds.map(() => "?").join(",")})`,
    ...playerIds
  );

  const report: PhotoSyncReport = {
    selected: players.length,
    alreadyLocal: 0,
    downloaded: 0,
    unmatched: [],
    failed: [],
    clubsUnresolved: [],
  };

  const sdbTeams = await fetchSdbTeamsByKey(key);
  const squadCache = new Map<string, SdbPlayer[]>();

  for (const player of players) {
    const name = `${player.fname} ${player.lname}`.trim();
    if (player.photo_url?.startsWith("/players/")) {
      report.alreadyLocal++;
      continue;
    }

    const clubKey = canonicalClubKey(player.club_name);
    const sdbTeamId = sdbTeams.get(clubKey);
    if (!sdbTeamId) {
      if (!report.clubsUnresolved.includes(player.club_name)) report.clubsUnresolved.push(player.club_name);
      report.unmatched.push({ playerId: Number(player.id), name, clubName: player.club_name });
      continue;
    }

    let squad = squadCache.get(sdbTeamId);
    if (!squad) {
      squad = await fetchSdbSquad(key, sdbTeamId);
      squadCache.set(sdbTeamId, squad);
      await new Promise((r) => setTimeout(r, 700)); // rate limit premium 100/min
    }

    const idx = matchPlayerName(name, squad.map((s) => s.strPlayer));
    const photoUrl = idx >= 0 ? squad[idx].strCutout || squad[idx].strThumb : null;
    if (!photoUrl) {
      report.unmatched.push({ playerId: Number(player.id), name, clubName: player.club_name });
      continue;
    }

    try {
      const localPath = await downloadToLocal(photoUrl, Number(player.id));
      await prisma.$executeRawUnsafe("UPDATE PLAYER SET PHOTO_URL = ? WHERE ID_PLAYER = ?", localPath, Number(player.id));
      report.downloaded++;
    } catch (e) {
      report.failed.push({ playerId: Number(player.id), name, error: e instanceof Error ? e.message : "?" });
    }
  }

  return report;
}
