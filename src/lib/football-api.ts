/**
 * Football API abstraction (provider-agnostic).
 *
 * EFFECTIFS (clubs + joueurs, noms et postes) : football-data.org, dont le
 * tier GRATUIT couvre la Ligue 1 avec les effectifs complets (pas de photos,
 * elles viennent de TheSportsDB premium au lancement, cf photo-sync.ts).
 * Token saisi par les admins dans Admin → Configuration (APP_CONFIG),
 * fallback env FOOTBALL_DATA_TOKEN. Sans token : mock déterministe.
 *
 * Clubs seuls : fallback TheSportsDB gratuit (lookup_all_teams) si
 * football-data.org indisponible, comme avant.
 *
 * Bascule env :
 *   FOOTBALL_API_MOCK      ("true" force le mock partout ; "false" force le live)
 *   FOOTBALL_DATA_TOKEN    (fallback du token saisi dans l'admin)
 *   THESPORTSDB_KEY        (def: "3" = clé free tier, clubs seulement)
 *
 * Chaque fonction renvoie un `source: "live" | "mock"` pour que l'UI puisse
 * signaler à l'admin d'où viennent les données.
 */

import { getAppConfig, CONFIG_KEYS } from "./app-config";

export type ApiPosition = "Gardien" | "Défense" | "Milieu" | "Attaque";

export const POSITIONS: ApiPosition[] = ["Gardien", "Défense", "Milieu", "Attaque"];

export interface ApiClub {
  externalId: string;
  name: string;
  badgeUrl: string | null;
}

export interface ApiPlayer {
  externalId: string;
  fname: string;
  lname: string;
  position: ApiPosition;
  photoUrl: string | null;
}

export interface FetchResult<T> {
  source: "live" | "mock";
  provider: string;
  data: T;
}

const FORCE_MOCK = process.env.FOOTBALL_API_MOCK === "true";
const FORCE_LIVE = process.env.FOOTBALL_API_MOCK === "false";
const SDB_KEY = process.env.THESPORTSDB_KEY || "3";
const SDB_BASE = "https://www.thesportsdb.com/api/v1/json";
const L1_LEAGUE_ID = "4334";
const FD_BASE = "https://api.football-data.org/v4";
const FD_COMPETITION = "FL1"; // Ligue 1

/**
 * Normalise une position brute (API ou saisie) vers la classification Ligue
 * Enchantée. La Ligue fait foi : l'admin pourra toujours corriger ensuite.
 */
export function normalizePosition(raw: string | null | undefined): ApiPosition {
  const p = (raw || "").trim().toLowerCase();
  if (/(gardien|goalkeeper|keeper|\bgk\b|portero)/.test(p)) return "Gardien";
  if (/(défens|defens|defence|defender|\bdf\b|back|arrière|lateral)/.test(p)) return "Défense";
  if (/(milieu|midfield|\bmf\b|middle)/.test(p)) return "Milieu";
  if (/(attaq|attack|forward|striker|winger|offence|\bst\b|\bfw\b)/.test(p)) return "Attaque";
  // Défaut prudent : milieu (poste le plus neutre), l'admin tranchera.
  return "Milieu";
}

// ── Live : football-data.org (effectifs complets, tier gratuit) ────────────

interface FdSquadMember {
  id: number;
  name: string;
  position: string | null;
}
interface FdTeam {
  id: number;
  name: string;
  crest: string | null;
  squad: FdSquadMember[];
}

// L'endpoint /competitions/FL1/teams renvoie les 18 clubs AVEC leurs
// effectifs complets en un seul appel. On le met en cache mémoire quelques
// minutes : le stepper appelle getSquad club par club et le tier gratuit est
// limité à 10 requêtes/minute.
let fdCache: { at: number; teams: FdTeam[] } | null = null;
const FD_CACHE_TTL_MS = 10 * 60 * 1000;

async function getFootballDataToken(): Promise<string | null> {
  try {
    const fromDb = await getAppConfig(CONFIG_KEYS.FOOTBALL_DATA_TOKEN);
    if (fromDb) return fromDb;
  } catch {
    /* table absente ou DB down : on tente l'env */
  }
  return process.env.FOOTBALL_DATA_TOKEN || null;
}

async function fetchFdTeams(): Promise<FdTeam[]> {
  if (fdCache && Date.now() - fdCache.at < FD_CACHE_TTL_MS) return fdCache.teams;
  const token = await getFootballDataToken();
  if (!token) throw new Error("Pas de token football-data.org (Admin → Configuration, champ Clé effectifs)");
  const res = await fetch(`${FD_BASE}/competitions/${FD_COMPETITION}/teams`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}`);
  const json = (await res.json()) as { teams?: FdTeam[] };
  const teams = json.teams || [];
  if (teams.length === 0) throw new Error("football-data.org : aucune équipe renvoyée");
  fdCache = { at: Date.now(), teams };
  return teams;
}

// "Kylian Mbappé" -> fname "Kylian", lname "Mbappé" ; les noms composés
// partent dans le lname ("Van den Boomen").
function splitName(full: string): { fname: string; lname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { fname: "", lname: parts[0] };
  return { fname: parts[0], lname: parts.slice(1).join(" ") };
}

function fdTeamToClub(t: FdTeam): ApiClub {
  return { externalId: String(t.id), name: t.name, badgeUrl: t.crest || null };
}

function fdMemberToPlayer(m: FdSquadMember): ApiPlayer {
  const { fname, lname } = splitName(m.name);
  return {
    externalId: String(m.id),
    fname,
    lname,
    position: normalizePosition(m.position),
    photoUrl: null, // les photos viennent de TheSportsDB premium, au lancement
  };
}

// ── Live : TheSportsDB (fallback clubs seulement) ───────────────────────────

interface SdbTeam {
  idTeam: string;
  strTeam: string;
  strBadge?: string;
  strTeamBadge?: string;
}

async function fetchClubsLive(): Promise<ApiClub[]> {
  const url = `${SDB_BASE}/${SDB_KEY}/lookup_all_teams.php?id=${L1_LEAGUE_ID}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TheSportsDB ${res.status}`);
  const json = (await res.json()) as { teams?: SdbTeam[] };
  const teams = json.teams || [];
  if (teams.length === 0) throw new Error("TheSportsDB: aucune équipe renvoyée");
  return teams.map((t) => ({
    externalId: t.idTeam,
    name: t.strTeam,
    badgeUrl: t.strBadge || t.strTeamBadge || null,
  }));
}

// ── Mock déterministe ───────────────────────────────────────────────────────

const MOCK_CLUB_NAMES = [
  "Paris Saint-Germain", "Olympique de Marseille", "AS Monaco", "Olympique Lyonnais",
  "LOSC Lille", "OGC Nice", "RC Lens", "Stade Rennais", "Stade de Reims",
  "RC Strasbourg", "FC Nantes", "Montpellier HSC", "Stade Brestois", "Toulouse FC",
  "AJ Auxerre", "Le Havre AC", "Angers SCO", "FC Metz",
];

// Squelette d'effectif réaliste : 3 GK, 7 DEF, 7 MIL, 4 ATT = 21 joueurs.
const MOCK_SQUAD_SHAPE: ApiPosition[] = [
  "Gardien", "Gardien", "Gardien",
  "Défense", "Défense", "Défense", "Défense", "Défense", "Défense", "Défense",
  "Milieu", "Milieu", "Milieu", "Milieu", "Milieu", "Milieu", "Milieu",
  "Attaque", "Attaque", "Attaque", "Attaque",
];

const MOCK_FNAMES = [
  "Lucas", "Hugo", "Nathan", "Théo", "Enzo", "Léo", "Gabriel", "Adam", "Raphaël",
  "Louis", "Jules", "Arthur", "Noah", "Liam", "Sacha", "Maël", "Tom", "Aaron",
  "Naël", "Ethan", "Marius",
];
const MOCK_LNAMES = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Petit", "Durand", "Leroy",
  "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand",
  "Roux", "Vincent", "Fournier", "Morel", "Girard",
];

function mockClubs(): ApiClub[] {
  return MOCK_CLUB_NAMES.map((name, i) => ({
    externalId: `mock-club-${i + 1}`,
    name,
    badgeUrl: null,
  }));
}

function mockSquad(clubExternalId: string): ApiPlayer[] {
  // Seed déterministe à partir de l'id du club pour des noms stables.
  const seedMatch = clubExternalId.match(/(\d+)/);
  const seed = seedMatch ? parseInt(seedMatch[1], 10) : 1;
  return MOCK_SQUAD_SHAPE.map((position, idx) => {
    const f = MOCK_FNAMES[(seed * 3 + idx) % MOCK_FNAMES.length];
    const l = MOCK_LNAMES[(seed * 7 + idx * 2) % MOCK_LNAMES.length];
    return {
      externalId: `${clubExternalId}-p${idx + 1}`,
      fname: f,
      lname: l,
      position,
      photoUrl: null,
    };
  });
}

// ── API publique ────────────────────────────────────────────────────────────

export async function getClubs(): Promise<FetchResult<ApiClub[]>> {
  if (!FORCE_MOCK) {
    // 1. football-data.org (clubs + effectifs dans le même appel)
    try {
      const teams = await fetchFdTeams();
      return { source: "live", provider: "football-data.org", data: teams.map(fdTeamToClub) };
    } catch (e) {
      if (FORCE_LIVE) throw e;
    }
    // 2. Fallback TheSportsDB gratuit (clubs seulement, comme avant)
    try {
      const data = await fetchClubsLive();
      return { source: "live", provider: "thesportsdb", data };
    } catch (e) {
      if (FORCE_LIVE) throw e;
    }
  }
  return { source: "mock", provider: "mock", data: mockClubs() };
}

/**
 * Effectif complet d'un club (noms + postes, pas de photos).
 * Live = football-data.org si un token est configuré, sinon mock.
 */
export async function getSquad(clubExternalId: string): Promise<FetchResult<ApiPlayer[]>> {
  if (!FORCE_MOCK) {
    try {
      const teams = await fetchFdTeams();
      const team = teams.find((t) => String(t.id) === clubExternalId);
      if (team) {
        return {
          source: "live",
          provider: "football-data.org",
          data: (team.squad || []).map(fdMemberToPlayer),
        };
      }
      // Club inconnu de football-data.org (id mock ou autre provider).
      if (FORCE_LIVE) throw new Error(`Club ${clubExternalId} introuvable chez football-data.org`);
    } catch (e) {
      if (FORCE_LIVE) throw e;
    }
  }
  return { source: "mock", provider: "mock", data: mockSquad(clubExternalId) };
}
