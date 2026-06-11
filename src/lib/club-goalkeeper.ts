// Pseudo-joueurs « Gardiens [Club] » : implémentation PURE de la règle 2.1
// et de la décision du 2026-06-10 (docs/regles-encheres.md §7).
//
// Le gardien d'un effectif est désigné par son CLUB, pas par son identité :
// un pseudo-joueur « Gardiens [Club] » (1 par club, position Gardien) est
// stocké dans PLAYER avec une clé stable dans LINK (ex: `gardiens_marseille`).
// Sa note de journée est celle du gardien nommé réellement aligné par le
// club ce jour-là. Aucune note de gardien ce jour-là = même comportement
// que n'importe quel joueur sans ligne SCORE.
//
// Zéro dépendance DB ou React : importable par db.ts, les routes, les
// scripts CLI et les tests vitest.

export const CLUB_GK_KEY_PREFIX = "gardiens_";

// Position stockée pour les pseudo-gardiens. Doit contenir « gardien »
// (insensible à la casse) : c'est ce que détectent mapPosition (db.ts,
// publish, lineup) pour la ligne GK et le quota « exactement 1 gardien ».
export const CLUB_GK_POSITION = "Gardien";

// FNAME des pseudo-gardiens ; LNAME = nom du club → « Gardiens Marseille ».
export const CLUB_GK_FNAME = "Gardiens";

// ── Clé stable ────────────────────────────────────────────────────────────
// `gardiens_<slug du nom de club>` : survit à l'import des effectifs réels
// (aucun ID en dur). Ex: "Saint-Étienne" → "gardiens_saint_etienne".
export function clubGoalkeeperKey(clubName: string): string {
  const slug = clubName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents (diacritiques combinants)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${CLUB_GK_KEY_PREFIX}${slug}`;
}

// ── Détection ─────────────────────────────────────────────────────────────
export interface ClubGkPlayerLike {
  id: number;
  clubId: number;
  position: string;
  link: string | null;
}

export function isGoalkeeperPosition(position: string): boolean {
  return position.toLowerCase().includes("gardien");
}

// Pseudo-joueur « Gardiens [Club] » (proposable à la mise).
export function isClubGoalkeeper(p: { position: string; link: string | null }): boolean {
  return isGoalkeeperPosition(p.position) && (p.link ?? "").startsWith(CLUB_GK_KEY_PREFIX);
}

// Gardien nommé (visible dans l'explorateur, JAMAIS proposable à la mise).
export function isNamedGoalkeeper(p: { position: string; link: string | null }): boolean {
  return isGoalkeeperPosition(p.position) && !(p.link ?? "").startsWith(CLUB_GK_KEY_PREFIX);
}

// ── Résolution de la note ─────────────────────────────────────────────────
// Sous-ensemble d'une ligne SCORE suffisant pour la résolution. `points`
// accepte number ou Decimal Prisma (converti via Number()).
// `used` : 1 si le joueur était aligné (titulaire ou remplaçant entré en jeu)
// ce jour-là. Les lignes sans champ `used` sont traitées comme used=0.
export interface ClubGkScoreLike {
  playerId: number;
  points: number | { toString(): string };
  goals: number;
  used?: number;
}

function notes(s: ClubGkScoreLike): number {
  return Number(s.points);
}

// Choix déterministe quand PLUSIEURS gardiens du même club sont notés le
// même jour (ex: titulaire blessé en cours de match, remplaçant noté aussi).
//
// Règle m1 (finding review 2026-06-11) : si au moins une ligne used=1 existe,
// on choisit UNIQUEMENT parmi celles-ci (gardiens effectivement alignés).
// En l'absence de ligne used=1, on repart sur l'ensemble (comportement
// précédent, compatible avec les données historiques sans flag used).
//
// Parmi les lignes retenues : meilleure note, puis plus de buts, puis plus
// petit ID (stabilité totale). Décision Julien 2026-06-11, tracée §7.
export function pickAlignedGoalkeeperScore<S extends ClubGkScoreLike>(
  rows: S[]
): S | undefined {
  if (rows.length === 0) return undefined;
  const usedRows = rows.filter((r) => (r.used ?? 0) === 1);
  const candidates = usedRows.length > 0 ? usedRows : rows;
  return [...candidates].sort(
    (a, b) => notes(b) - notes(a) || b.goals - a.goals || a.playerId - b.playerId
  )[0];
}

// Construit un résolveur de ligne SCORE pour UNE journée :
// - pseudo-gardien → ligne du gardien nommé aligné par son club ce jour-là
// - tout autre joueur → sa propre ligne (comportement inchangé)
// - aucune ligne résoluble → undefined (même traitement que sans note)
export function buildDayScoreResolver<S extends ClubGkScoreLike>(
  players: Iterable<ClubGkPlayerLike>,
  dayScores: Iterable<S>
): (playerId: number) => S | undefined {
  const playersById = new Map<number, ClubGkPlayerLike>();
  const namedGkIdsByClub = new Map<number, number[]>();
  for (const p of Array.from(players)) {
    playersById.set(p.id, p);
    if (isNamedGoalkeeper(p)) {
      const arr = namedGkIdsByClub.get(p.clubId) ?? [];
      arr.push(p.id);
      namedGkIdsByClub.set(p.clubId, arr);
    }
  }
  const scoreByPlayer = new Map<number, S>();
  for (const s of Array.from(dayScores)) scoreByPlayer.set(s.playerId, s);

  return (playerId: number) => {
    const p = playersById.get(playerId);
    if (p && isClubGoalkeeper(p)) {
      const rows = (namedGkIdsByClub.get(p.clubId) ?? [])
        .map((id) => scoreByPlayer.get(id))
        .filter((s): s is S => s !== undefined);
      return pickAlignedGoalkeeperScore(rows);
    }
    return scoreByPlayer.get(playerId);
  };
}

// Ids à inclure dans la requête SCORE pour pouvoir résoudre les
// pseudo-gardiens d'une compo : ids de la compo + ids des gardiens nommés
// des clubs dont un pseudo-gardien figure dans la compo. Sans pseudo-gardien
// dans la compo, renvoie la liste d'origine (aucun surcoût).
export function expandIdsForGoalkeeperResolution(
  lineupIds: number[],
  allPlayers: Iterable<ClubGkPlayerLike>
): number[] {
  const lineupSet = new Set(lineupIds);
  const pseudoClubIds = new Set<number>();
  const namedGks: ClubGkPlayerLike[] = [];
  for (const p of Array.from(allPlayers)) {
    if (lineupSet.has(p.id) && isClubGoalkeeper(p)) pseudoClubIds.add(p.clubId);
    else if (isNamedGoalkeeper(p)) namedGks.push(p);
  }
  if (pseudoClubIds.size === 0) return lineupIds;
  const expanded = new Set(lineupIds);
  for (const gk of namedGks) {
    if (pseudoClubIds.has(gk.clubId)) expanded.add(gk.id);
  }
  return Array.from(expanded);
}

// Pour les agrégations multi-journées (stats cumulées) : fabrique, pour
// chaque pseudo-gardien donné, des lignes SCORE synthétiques (une par
// journée où un gardien nommé de son club est noté), portant l'id du
// pseudo-joueur. Les lignes réelles ne sont jamais modifiées.
export function attributeClubGoalkeeperDayScores<
  S extends ClubGkScoreLike & { day: number }
>(
  pseudoGkIds: number[],
  allPlayers: Iterable<ClubGkPlayerLike>,
  scores: Iterable<S>
): S[] {
  const playersById = new Map<number, ClubGkPlayerLike>();
  for (const p of Array.from(allPlayers)) playersById.set(p.id, p);

  // Lignes des gardiens nommés, groupées par (clubId, day).
  const namedRowsByClubDay = new Map<string, S[]>();
  for (const s of Array.from(scores)) {
    const p = playersById.get(s.playerId);
    if (!p || !isNamedGoalkeeper(p)) continue;
    const key = `${p.clubId}|${s.day}`;
    const arr = namedRowsByClubDay.get(key) ?? [];
    arr.push(s);
    namedRowsByClubDay.set(key, arr);
  }

  const synthetic: S[] = [];
  for (const pseudoId of pseudoGkIds) {
    const pseudo = playersById.get(pseudoId);
    if (!pseudo || !isClubGoalkeeper(pseudo)) continue;
    for (const [key, rows] of Array.from(namedRowsByClubDay.entries())) {
      const [clubId] = key.split("|");
      if (Number(clubId) !== pseudo.clubId) continue;
      const aligned = pickAlignedGoalkeeperScore(rows);
      if (aligned) synthetic.push({ ...aligned, playerId: pseudoId });
    }
  }
  return synthetic;
}
