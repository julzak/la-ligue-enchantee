// Fuseau de Paris : UTC+1 en hiver (CET), UTC+2 en ete (CEST). La saison va
// d'aout a mai, donc les deux regimes sont traverses dans une meme saison.
// Coder l'offset en dur (+2) decale la deadline d'1h d'octobre a mars : une
// deadline "15h Paris" se fermait a 14h en hiver, a l'affichage comme a
// l'enforcement. Ces helpers calculent l'offset reel via le fuseau IANA.

// Offset UTC de l'heure de Paris (en heures) a l'instant donne : 1 ou 2.
export function parisUtcOffsetHours(at: Date): number {
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  const paris = new Date(at.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return Math.round((paris.getTime() - utc.getTime()) / 3_600_000);
}

// Instant UTC correspondant a `hour`h`minute` heure de Paris le jour `dateYmd`
// (format "YYYY-MM-DD"). Determine l'offset du jour puis le retranche.
// Correct hors de la fenetre de bascule DST (une heure, une fois par an), sans
// impact aux heures de deadline usuelles (13h-20h).
export function parisWallTimeToUtc(dateYmd: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const approx = new Date(`${dateYmd}T${hh}:${mm}:00Z`);
  const offset = parisUtcOffsetHours(approx);
  return new Date(approx.getTime() - offset * 3_600_000);
}

// ── Sens inverse : instant UTC -> date/heure murales de Paris ──────────────
// football-data.org renvoie des utcDate : les stocker tels quels décalerait
// les matchs du soir (un coup d'envoi à 21h Paris est à 19h ou 20h UTC, et
// bascule de jour à cheval sur minuit) et fausserait deadlines et éditions
// L'Équipe. Partagé entre le sync calendrier et les scripts CLI de scraping.

const PARIS_PARTS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

export function toParisDateTime(iso: string): { date: string; time: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const part of PARIS_PARTS.formatToParts(d)) p[part.type] = part.value;
  if (!p.year || !p.month || !p.day) return null;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    // "24" à minuit selon l'implémentation d'Intl : ramené à "00".
    time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}`,
  };
}

/** "2026-08-21" -> "2026-08-22" (édition L'Équipe = lendemain du match). */
export function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "2026-2027" | "2026" -> 2026 (année de début, format saison football-data). */
export function seasonStartYear(seasonKey: string): number | null {
  const m = seasonKey.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}
