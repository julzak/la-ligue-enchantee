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
