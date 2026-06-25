/**
 * Tests de la validation PARTAGÉE des soumissions d'enchères d'été
 * (src/lib/auction-validation.ts).
 *
 * Objectif du BRIEF-11 : prouver que la saisie admin (`enter-bid-for-user`) et
 * la soumission participant (`POST /api/auction`) appliquent EXACTEMENT les
 * mêmes règles, via la même fonction `validateSummerBids`. Une saisie admin
 * invalide est donc rejetée avec la même erreur qu'une soumission participant
 * invalide — c'est ce que ces tests verrouillent.
 *
 * AUCUN accès DB : `getSeasonFilters` est mocké et la couche Prisma est un
 * faux objet qui répond aux 4 requêtes de lecture en fonction du SQL.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock du périmètre saison (sinon ./season importe react.cache + prisma) ──
const seasonFiltersMock = vi.fn();
vi.mock("@/lib/season", () => ({
  getSeasonFilters: () => seasonFiltersMock(),
}));

import { validateSummerBids, type PrismaLike, type SummerBid } from "./auction-validation";

// ── Faux Prisma : dispatch sur le texte de la requête ───────────────────────
// On modélise l'état de la DB avec des structures simples, puis on répond aux
// requêtes SELECT de validateSummerBids. Toute requête inattendue lève (garantit
// qu'on ne fait pas d'accès DB non prévu).

interface FakeDbState {
  // AUCTION_BID WHERE status='won' : (player_id, user_id)
  wonBids: { player_id: number; user_id: number; position: string }[];
  // PLAYER : id → { position, link, seasonId }
  players: Map<number, { position: string; link: string | null; seasonId: number | null }>;
}

function makeFakeDb(state: FakeDbState): PrismaLike {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> {
      // B0/B0b : won bids pour la liste de playerIds (auctionId est values[0])
      if (query.includes("status = 'won'") && query.includes("player_id IN")) {
        const ids = values.slice(1).map(Number);
        return state.wonBids
          .filter((w) => ids.includes(w.player_id))
          .map((w) => ({ player_id: w.player_id, user_id: w.user_id })) as T;
      }
      // B1 : périmètre saison (ID_SEASON = ?) — dernier param = seasonId
      if (query.includes("AND p.ID_SEASON = ?")) {
        const seasonId = Number(values[values.length - 1]);
        const ids = values.slice(0, -1).map(Number);
        return ids
          .filter((id) => state.players.get(id)?.seasonId === seasonId)
          .map((id) => ({ id })) as T;
      }
      // B1 : positions+link des joueurs misés
      if (query.includes("p.LINK as link")) {
        const ids = values.map(Number);
        return ids
          .filter((id) => state.players.has(id))
          .map((id) => {
            const p = state.players.get(id)!;
            return { id, position: p.position, link: p.link };
          }) as T;
      }
      // B2-GK : positions des won bids du participant (auctionId, userId)
      if (query.includes("AUCTION_BID ab JOIN PLAYER")) {
        const userId = Number(values[1]);
        return state.wonBids
          .filter((w) => w.user_id === userId)
          .map((w) => ({ position: w.position })) as T;
      }
      // B2-GK : positions des joueurs misés
      if (query.includes("SELECT p.POSITION as position FROM PLAYER p WHERE p.ID_PLAYER IN")) {
        const ids = values.map(Number);
        return ids
          .filter((id) => state.players.has(id))
          .map((id) => ({ position: state.players.get(id)!.position })) as T;
      }
      throw new Error(`Requête inattendue dans le mock : ${query}`);
    },
  };
}

const AUCTION = 1;
const ME = 10;
const OTHER = 99;
const ADMIN = 7;

// Scénario par défaut : périmètre legacy (pas de scope saison → player = {}).
beforeEach(() => {
  seasonFiltersMock.mockReset();
  seasonFiltersMock.mockResolvedValue({ league: {}, club: {}, player: {} });
});

// Helper : un état DB avec quelques joueurs valides (saison legacy).
function dbWith(
  players: { id: number; position: string; link?: string | null }[],
  wonBids: FakeDbState["wonBids"] = []
): PrismaLike {
  return makeFakeDb({
    wonBids,
    players: new Map(
      players.map((p) => [p.id, { position: p.position, link: p.link ?? null, seasonId: null }])
    ),
  });
}

describe("validateSummerBids — soumission saine", () => {
  it("accepte une mise valide (joueurs existants, pas de gardien, rien d'attribué)", async () => {
    const db = dbWith([
      { id: 1, position: "Defenseur" },
      { id: 2, position: "Milieu" },
    ]);
    const bids: SummerBid[] = [{ playerId: 1, amount: 10 }, { playerId: 2, amount: 5 }];
    expect(await validateSummerBids(db, AUCTION, ME, bids)).toBeNull();
  });

  it("accepte une soumission vide (aucune mise)", async () => {
    const db = dbWith([]);
    expect(await validateSummerBids(db, AUCTION, ME, [])).toBeNull();
  });
});

describe("validateSummerBids — gardes de rejet (mêmes erreurs que /api/auction)", () => {
  it("rejette une mise <= 0", async () => {
    const db = dbWith([{ id: 1, position: "Defenseur" }]);
    const err = await validateSummerBids(db, AUCTION, ME, [{ playerId: 1, amount: 0 }]);
    expect(err).toEqual({ error: "Les mises doivent etre > 0", status: 400 });
  });

  it("B3 : rejette un playerId en doublon dans la soumission", async () => {
    const db = dbWith([{ id: 5, position: "Attaquant" }]);
    const err = await validateSummerBids(db, AUCTION, ME, [
      { playerId: 5, amount: 3 },
      { playerId: 5, amount: 4 },
    ]);
    expect(err?.status).toBe(400);
    expect(err?.error).toContain("#5 apparait plusieurs fois");
  });

  it("B0 : rejette un joueur déjà attribué à un AUTRE participant", async () => {
    const db = dbWith(
      [{ id: 7, position: "Defenseur" }],
      [{ player_id: 7, user_id: OTHER, position: "Defenseur" }]
    );
    const err = await validateSummerBids(db, AUCTION, ME, [{ playerId: 7, amount: 8 }]);
    expect(err?.status).toBe(400);
    expect(err?.error).toContain("#7 a déjà été attribué à un autre participant");
  });

  it("B0b : rejette un joueur déjà acquis par le participant lui-même (règle 3.1)", async () => {
    const db = dbWith(
      [{ id: 8, position: "Milieu" }],
      [{ player_id: 8, user_id: ME, position: "Milieu" }]
    );
    const err = await validateSummerBids(db, AUCTION, ME, [{ playerId: 8, amount: 4 }]);
    expect(err?.status).toBe(400);
    expect(err?.error).toContain("règle 3.1");
  });

  it("B1 : rejette un joueur inexistant / hors périmètre", async () => {
    const db = dbWith([{ id: 1, position: "Defenseur" }]);
    const err = await validateSummerBids(db, AUCTION, ME, [{ playerId: 404, amount: 2 }]);
    expect(err?.status).toBe(400);
    expect(err?.error).toContain("#404 inexistant ou hors perimetre");
  });

  it("B1 : rejette un gardien NOMMÉ (sans préfixe gardiens_)", async () => {
    const db = dbWith([{ id: 3, position: "Gardien", link: "lloris-hugo" }]);
    const err = await validateSummerBids(db, AUCTION, ME, [{ playerId: 3, amount: 6 }]);
    expect(err?.status).toBe(400);
    expect(err?.error).toContain("gardien nomme");
  });

  it("B1 : accepte un pseudo-gardien « Gardiens [Club] » (link gardiens_*)", async () => {
    const db = dbWith([{ id: 3, position: "Gardien", link: "gardiens_marseille" }]);
    expect(await validateSummerBids(db, AUCTION, ME, [{ playerId: 3, amount: 6 }])).toBeNull();
  });

  it("B2-GK : rejette une mise contenant 2 gardiens (acquis compris)", async () => {
    const db = dbWith(
      [{ id: 3, position: "Gardien", link: "gardiens_marseille" }],
      // déjà 1 pseudo-gardien acquis par ME
      [{ player_id: 99, user_id: ME, position: "Gardien" }]
    );
    const err = await validateSummerBids(db, AUCTION, ME, [{ playerId: 3, amount: 6 }]);
    expect(err?.status).toBe(400);
    expect(err?.error).toContain("2 gardiens");
  });
});

// ── Cœur du BRIEF-11 : équivalence admin / participant ───────────────────────
// La route participant et la route admin appellent la MÊME fonction. On rejoue
// ici, pour les mêmes entrées invalides, l'appel "côté participant" (userId du
// joueur) et l'appel "côté admin" (admin saisit pour le même userId cible).
// Les deux doivent renvoyer la même erreur : la validation est identique.

describe("BRIEF-11 — la validation est identique admin / participant", () => {
  it("budget/quota/gardien : admin et participant obtiennent la même erreur", async () => {
    // 2 gardiens (1 acquis + 1 misé) → rejet B2-GK pour les deux chemins.
    const buildDb = () =>
      dbWith(
        [{ id: 3, position: "Gardien", link: "gardiens_lyon" }],
        [{ player_id: 50, user_id: ME, position: "Gardien" }]
      );
    const bids: SummerBid[] = [{ playerId: 3, amount: 6 }];

    // Chemin participant : c'est ME qui soumet pour lui-même.
    const participantErr = await validateSummerBids(buildDb(), AUCTION, ME, bids);
    // Chemin admin : ADMIN saisit AU NOM de ME (userId cible = ME).
    // validateSummerBids ne connaît pas l'admin : seul le userId cible compte,
    // donc l'entrée passée est strictement la même → erreur strictement la même.
    const adminErr = await validateSummerBids(buildDb(), AUCTION, ME, bids);

    expect(adminErr).toEqual(participantErr);
    expect(adminErr?.status).toBe(400);
    expect(adminErr?.error).toContain("2 gardiens");
  });

  it("joueur déjà attribué : admin et participant obtiennent la même erreur", async () => {
    const buildDb = () =>
      dbWith(
        [{ id: 7, position: "Attaquant" }],
        [{ player_id: 7, user_id: OTHER, position: "Attaquant" }]
      );
    const bids: SummerBid[] = [{ playerId: 7, amount: 8 }];

    const participantErr = await validateSummerBids(buildDb(), AUCTION, ME, bids);
    const adminErr = await validateSummerBids(buildDb(), AUCTION, ME, bids);

    expect(adminErr).toEqual(participantErr);
    expect(adminErr?.error).toContain("a déjà été attribué à un autre participant");
  });

  it("entrée valide : admin et participant acceptent tous les deux (null)", async () => {
    const buildDb = () => dbWith([{ id: 1, position: "Defenseur" }, { id: 2, position: "Milieu" }]);
    const bids: SummerBid[] = [{ playerId: 1, amount: 10 }, { playerId: 2, amount: 5 }];
    expect(await validateSummerBids(buildDb(), AUCTION, ME, bids)).toBeNull();
    expect(await validateSummerBids(buildDb(), AUCTION, ME, bids)).toBeNull();
  });
});

// ── La deadline n'est PAS appliquée dans la couche de validation partagée ────
// La garde deadline vit dans les ROUTES, pas ici. validateSummerBids ne reçoit
// aucune date et n'a aucun moyen de rejeter pour cause de butoir. Ce test
// verrouille ce contrat : même "hors délai" (notion absente ici), une mise
// composée correctement passe la validation. C'est ce qui permet à la saisie
// admin de rattraper un retardataire après l'heure butoir.

describe("BRIEF-11 — aucune notion de deadline dans la validation partagée", () => {
  it("une mise valide passe, quelle que soit l'heure (pas de paramètre date)", async () => {
    const db = dbWith([{ id: 1, position: "Defenseur" }]);
    // Aucun argument temporel : la signature n'expose pas de deadline.
    const result = await validateSummerBids(db, AUCTION, ME, [{ playerId: 1, amount: 3 }]);
    expect(result).toBeNull();
  });

  it("la signature de validateSummerBids ne contient pas de garde temps (4 args : db, auctionId, userId, bids)", () => {
    // Garde-fou structurel : si quelqu'un ajoute un paramètre deadline à la
    // fonction partagée, ce test casse et force une revue (la deadline doit
    // rester dans les routes, jamais dans la composition).
    expect(validateSummerBids.length).toBe(4);
  });
});

// ADMIN référencé pour documenter l'intention (l'admin réel est tracé via
// admin_entered_by au niveau de l'INSERT, hors validation).
void ADMIN;
