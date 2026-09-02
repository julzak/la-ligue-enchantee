// ── Quota de jokers d'un participant ────────────────────────────────────
// Règle : chaque type de jokers (JOKER_CONFIG) forme un « pot » avec un
// plafond (max_count) et éventuellement une date limite (deadline, ex. les
// jokers d'août « valables avant le 15 septembre »). Passé la date limite,
// les jokers NON utilisés du pot sont perdus ; ceux déjà posés dans la
// fenêtre restent acquis et ne doivent PAS être re-décomptés sur le pot
// suivant.
//
// Bug historique (remonté par Pierre le 2026-09-02) : les cinq points de
// calcul faisaient `Σ max_count des pots ouverts − nb total de jokers posés`.
// Une fois la deadline d'août passée, un participant ayant posé 2 jokers en
// août passait de 5 restants (7−2) à 2 (4−2) au lieu de 4 : ses 2 jokers
// d'août étaient soustraits une seconde fois du pot « saison ». Tout le
// monde « perdait 3 jokers », utilisés ou non.
//
// Fonction PURE (testée dans joker-quota.test.ts), partagée par l'API
// self-service, l'API admin et le classement (getLeagueJokersRemaining).

export interface JokerPool {
  type: string;
  maxCount: number;
  /** Date limite de pose (DATE ou DATETIME côté DB) ; null = valable toute la saison. */
  deadline: Date | string | null;
}

export interface JokerPoolUsage {
  type: string;
  maxCount: number;
  /** Jokers attribués à ce pot. */
  used: number;
  /** Le pot accepte-t-il encore des jokers à l'instant `now` ? */
  open: boolean;
  deadline: Date | null;
}

export interface JokerQuota {
  /** Plafond des pots encore ouverts (= l'ancien `totalMax`). */
  maxTotal: number;
  /** Nombre total de jokers posés (toutes fenêtres). */
  used: number;
  /** Jokers encore posables maintenant (peut être négatif si un admin a forcé). */
  remaining: number;
  pools: JokerPoolUsage[];
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Un pot est ouvert à l'instant `t` si sa deadline n'est pas atteinte (tolérance zéro : fermé pile à la deadline). */
function isOpenAt(deadline: Date | null, t: number): boolean {
  return deadline === null || t < deadline.getTime();
}

/**
 * Attribue chaque joker (par ordre de pose) au pot ouvert au moment de la
 * pose qui expire le plus tôt et a encore de la place. Un joker posé avant
 * la deadline d'août consomme donc d'abord un joker d'août ; un joker posé
 * après ne peut consommer qu'un joker « saison ».
 *
 * `usedAt` : dates de pose (JOKER_LOG.created_at). Une date absente (ligne
 * legacy) est traitée comme antérieure à toute deadline.
 */
export function computeJokerQuota(
  now: Date,
  pools: readonly JokerPool[],
  usedAt: readonly (Date | string | null)[]
): JokerQuota {
  const nowMs = now.getTime();

  // Pots triés par deadline croissante, les pots sans deadline en dernier.
  const sorted: JokerPoolUsage[] = pools
    .map((p) => ({
      type: p.type,
      maxCount: Math.max(0, Math.floor(Number(p.maxCount) || 0)),
      used: 0,
      deadline: toDate(p.deadline),
      open: false,
    }))
    .sort((a, b) => {
      const da = a.deadline ? a.deadline.getTime() : Number.POSITIVE_INFINITY;
      const db = b.deadline ? b.deadline.getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });
  for (const p of sorted) p.open = isOpenAt(p.deadline, nowMs);

  // Jokers par ordre de pose (date absente = le plus ancien possible).
  const times = usedAt
    .map((t) => {
      const d = toDate(t);
      return d ? d.getTime() : Number.NEGATIVE_INFINITY;
    })
    .sort((a, b) => a - b);

  let unassigned = 0;
  for (const t of times) {
    const pool = sorted.find((p) => p.used < p.maxCount && isOpenAt(p.deadline, t));
    if (pool) pool.used += 1;
    else unassigned += 1;
  }

  const openPools = sorted.filter((p) => p.open);
  const maxTotal = openPools.reduce((s, p) => s + p.maxCount, 0);
  const remaining = openPools.reduce((s, p) => s + (p.maxCount - p.used), 0) - unassigned;

  return { maxTotal, used: times.length, remaining, pools: sorted };
}
