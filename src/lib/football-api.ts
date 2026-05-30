/**
 * Football API abstraction (provider-agnostic).
 *
 * Provider principal : TheSportsDB (gratuit, déjà utilisé partout sur le site
 * pour dates/scores/photos cutout). Ligue 1 = league id 4334.
 *
 * Tant que les endpoints "effectif complet" ne sont pas accessibles (premium
 * TheSportsDB), les EFFECTIFS sont servis depuis un MOCK déterministe. Les
 * CLUBS, eux, viennent du live (endpoint gratuit lookup_all_teams).
 *
 * Bascule live/mock pilotée par env :
 *   FOOTBALL_API_PROVIDER  (def: "thesportsdb")
 *   FOOTBALL_API_MOCK      ("true" force le mock partout ; "false" force le live)
 *   THESPORTSDB_KEY        (def: "3" = clé free tier)
 *
 * Chaque fonction renvoie un `source: "live" | "mock"` pour que l'UI puisse
 * signaler à l'admin d'où viennent les données.
 */

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

const PROVIDER = process.env.FOOTBALL_API_PROVIDER || "thesportsdb";
const FORCE_MOCK = process.env.FOOTBALL_API_MOCK === "true";
const FORCE_LIVE = process.env.FOOTBALL_API_MOCK === "false";
const SDB_KEY = process.env.THESPORTSDB_KEY || "3";
const SDB_BASE = "https://www.thesportsdb.com/api/v1/json";
const L1_LEAGUE_ID = "4334";

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

// ── Live : TheSportsDB ──────────────────────────────────────────────────────

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
    try {
      const data = await fetchClubsLive();
      return { source: "live", provider: PROVIDER, data };
    } catch (e) {
      if (FORCE_LIVE) throw e;
      // Sinon on retombe sur le mock silencieusement.
    }
  }
  return { source: "mock", provider: PROVIDER, data: mockClubs() };
}

/**
 * Effectif d'un club. L'endpoint live "effectif complet" de TheSportsDB est
 * premium : tant qu'on n'a pas la clé premium, on sert le mock. Le live sera
 * branché ici quand la clé sera fournie (FOOTBALL_API_MOCK=false).
 */
export async function getSquad(clubExternalId: string): Promise<FetchResult<ApiPlayer[]>> {
  // TODO(premium) : brancher lookup_all_players.php quand clé premium dispo.
  if (FORCE_LIVE) {
    throw new Error(
      "Effectif live non disponible : endpoint TheSportsDB premium requis. Retire FOOTBALL_API_MOCK=false."
    );
  }
  return { source: "mock", provider: PROVIDER, data: mockSquad(clubExternalId) };
}
