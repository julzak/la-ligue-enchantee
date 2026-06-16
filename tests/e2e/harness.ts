/**
 * Harnais E2E du module enchères.
 *
 * Pilote l'application RÉELLE par ses endpoints HTTP (comme le navigateur),
 * sur l'environnement de recette isolé (jamais la prod). Couvre la couche
 * route (gardes, auth) et les scénarios de bout en bout.
 *
 * Pré-requis avant `npm run test:e2e` :
 *   - conteneur MySQL recette up + base seedée (cf audits/recette-encheres-env.md)
 *   - app démarrée sur E2E_BASE_URL avec DATABASE_URL pointant la base recette
 *   - DATABASE_URL exporté pour ce process (reset/inspection via Prisma)
 *
 * Les IDs de joueurs sont LUS dans la fixture (pas codés en dur) : robuste aux
 * re-seeds.
 */

import { PrismaClient } from "@prisma/client";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
export const PASSWORD = process.env.RECETTE_PASSWORD ?? "recette2026";
export const LEAGUE_ID = Number(process.env.E2E_LEAGUE_ID ?? 24);

export const prisma = new PrismaClient();

// ── Session HTTP avec cookie jar ───────────────────────────────────────────
export interface Session {
  jar: Map<string, string>;
  userId: number;
  name: string;
}

function absorb(jar: Map<string, string>, res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

// Connexion via le flux next-auth credentials (CSRF -> callback -> session).
export async function login(name: string): Promise<Session> {
  const jar = new Map<string, string>();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  absorb(jar, csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const cb = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader(jar) },
    body: new URLSearchParams({ csrfToken, login: name, password: PASSWORD, redirect: "false", json: "true" }),
    redirect: "manual",
  });
  absorb(jar, cb);

  const sess = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader(jar) } })).json();
  const userId = sess?.user?.userId;
  if (!userId) throw new Error(`Échec de connexion pour « ${name} » (session vide)`);
  return { jar, userId: Number(userId), name };
}

export async function apiGet(s: Session, path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: cookieHeader(s.jar) } });
  return { status: res.status, body: await res.json().catch(() => null) };
}
export async function apiPost(s: Session, path: string, payload: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader(s.jar) },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Appel HTTP sans session (pour tester l'auth 401).
export async function apiGetAnon(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ── Raccourcis métier enchères ─────────────────────────────────────────────
export const submitBids = (s: Session, bids: { playerId: number; amount: number }[]) =>
  apiPost(s, "/api/auction", { leagueId: LEAGUE_ID, bids });

export const adminAction = (s: Session, action: string, extra: Record<string, unknown> = {}) =>
  apiPost(s, "/api/admin/auction", { action, leagueId: LEAGUE_ID, ...extra });

export const myResults = (s: Session, round?: number) =>
  apiGet(s, `/api/auction/results?leagueId=${LEAGUE_ID}${round ? `&round=${round}` : ""}`);

export const myState = (s: Session) => apiGet(s, `/api/auction?leagueId=${LEAGUE_ID}`);

// ── Fixture : reset + lecture (via Prisma sur la base de test) ──────────────

// Remet l'enchère à l'état vierge (tour 1 ouvert, aucune mise, aucun effectif).
// C'est du setup de banc d'essai, pas du jeu : autorisé en SQL.
export async function resetAuction(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE b FROM AUCTION_BID b JOIN AUCTION a ON a.id = b.auction_id WHERE a.league_id = ?`,
    LEAGUE_ID
  );
  await prisma.$executeRawUnsafe(
    `DELETE r FROM AUCTION_REMOVAL r JOIN AUCTION a ON a.id = r.auction_id WHERE a.league_id = ?`,
    LEAGUE_ID
  ).catch(() => {});
  await prisma.$executeRawUnsafe(`DELETE FROM TEAM WHERE ID_LEAGUE = ?`, LEAGUE_ID);
  await prisma.$executeRawUnsafe(
    `UPDATE AUCTION SET status = 'open', current_round = 1, round_deadline = NULL WHERE league_id = ?`,
    LEAGUE_ID
  );
}

export interface Fixture {
  seasonId: number;
  gkClubs: number[]; // pseudo-gardiens « Gardiens [Club] »
  namedGk: number[]; // gardiens nommés (non misables : doivent être rejetés)
  def: number[];
  mid: number[];
  att: number[];
}

// Lit les IDs réels de la fixture (saison de la ligue de test).
export async function loadFixture(): Promise<Fixture> {
  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID } });
  const seasonId = league?.seasonId ?? 0;
  const players = await prisma.player.findMany({
    where: { seasonId },
    select: { id: true, position: true, link: true },
    orderBy: { id: "asc" },
  });
  const line = (p: { position: string }) => {
    const l = p.position.toLowerCase();
    if (l.includes("gardien")) return "GK";
    if (l.includes("fense") || l.includes("défense")) return "DEF";
    if (l.includes("milieu")) return "MID";
    if (l.includes("attaq")) return "ATT";
    return "MID";
  };
  const gks = players.filter((p) => line(p) === "GK");
  return {
    seasonId,
    gkClubs: gks.filter((p) => (p.link ?? "").startsWith("gardiens_")).map((p) => p.id),
    namedGk: gks.filter((p) => !(p.link ?? "").startsWith("gardiens_")).map((p) => p.id),
    def: players.filter((p) => line(p) === "DEF").map((p) => p.id),
    mid: players.filter((p) => line(p) === "MID").map((p) => p.id),
    att: players.filter((p) => line(p) === "ATT").map((p) => p.id),
  };
}

export async function teamCount(userId: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM TEAM WHERE ID_LEAGUE = ? AND ID_USER = ?`,
    LEAGUE_ID,
    userId
  );
  return Number(rows[0]?.n ?? 0);
}

export async function teamLineCounts(userId: number): Promise<Record<string, number>> {
  const rows = await prisma.$queryRawUnsafe<{ position: string; n: bigint }[]>(
    `SELECT p.POSITION AS position, COUNT(*) AS n
     FROM TEAM t JOIN PLAYER p ON p.ID_PLAYER = t.ID_PLAYER
     WHERE t.ID_LEAGUE = ? AND t.ID_USER = ? GROUP BY p.POSITION`,
    LEAGUE_ID,
    userId
  );
  const out: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const r of rows) {
    const l = r.position.toLowerCase();
    const key = l.includes("gardien") ? "GK" : l.includes("fense") ? "DEF" : l.includes("milieu") ? "MID" : "ATT";
    out[key] += Number(r.n);
  }
  return out;
}

export async function closeHarness(): Promise<void> {
  await prisma.$disconnect();
}
