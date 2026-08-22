import { parisWallTimeToUtc } from "./paris-time";

// ── Journée d'effet d'un joker ───────────────────────────────────────────
// Règle (règlement saison dernière, rappelée par Pierre le 2026-08-21) : un
// joker pris AVANT 18h la veille du premier match d'une journée compte pour
// cette journée ; après, il compte pour la journée suivante. Tolérance zéro.
//
// Avant ce socle, les deux routes jokers prenaient « dernière journée publiée
// + 1 » : entre le cutoff et la publication (tout le week-end), un joker
// modifiait l'effectif d'une journée déjà verrouillée, voire déjà entamée
// (constaté J1 2026-2027 : Skippy vendredi 14h52, LST samedi 00h07 après le
// match du vendredi, tous deux enregistrés pour la J1).
export const JOKER_CUTOFF = { daysBefore: 1, hour: 18 } as const;

function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Instant UTC du cutoff joker d'une journée dont le premier match est le jour `firstMatchYmd`. */
export function jokerCutoffFor(firstMatchYmd: string): Date {
  return parisWallTimeToUtc(shiftYmd(firstMatchYmd, -JOKER_CUTOFF.daysBefore), JOKER_CUTOFF.hour);
}

/**
 * Première journée > currentDay dont le cutoff n'est pas passé. Une journée
 * sans calendrier connu est considérée ouverte (on ne peut pas faire mieux).
 * Fonction pure, testée dans joker-day.test.ts.
 */
export function computeJokerEffectDay(
  now: Date,
  currentDay: number,
  firstMatchYmdByDay: ReadonlyMap<number, string>
): { effectDay: number; cutoff: Date | null } {
  let day = currentDay + 1;
  for (;;) {
    const ymd = firstMatchYmdByDay.get(day);
    if (!ymd) return { effectDay: day, cutoff: null };
    const cutoff = jokerCutoffFor(ymd);
    if (now.getTime() < cutoff.getTime()) return { effectDay: day, cutoff };
    day += 1;
    if (day > 38) return { effectDay: 38, cutoff: null };
  }
}

