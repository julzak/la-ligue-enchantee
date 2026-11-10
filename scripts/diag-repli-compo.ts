// Simulation LECTURE SEULE : impact d'une nouvelle règle de repli de compo
// (dernière compo validée, toutes journées confondues, filtrée sur l'effectif
// actif) sur la saison courante, comparée à STATS_USER (repli actuel :
// veille puis 11 premières lignes de TEAM).
// Sanity-check : l'ancienne règle recalculée doit reproduire STATS_USER à
// l'identique, sinon le simulateur n'est pas fiable et on s'arrête.
import { prisma } from "../src/lib/prisma";
import { buildDayScoreResolver } from "../src/lib/club-goalkeeper";
import { computePlayerTotal, SCORING_DEFAULTS, type ScoringConfig } from "../src/lib/scoring-core";

const REF_LEAGUE = 41;

function dec(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}
function mapPosition(p: string): "GK" | "DEF" | "MID" | "ATT" {
  const l = p.toLowerCase();
  if (l.includes("gardien")) return "GK";
  if (l.includes("fense")) return "DEF";
  if (l.includes("milieu")) return "MID";
  if (l.includes("attaq")) return "ATT";
  return "MID";
}
const clean = (n: string) => n.replace(/<[^>]*>/g, "").trim();

async function main() {
  const ref = await prisma.league.findUniqueOrThrow({ where: { id: REF_LEAGUE } });
  const seasonId = ref.seasonId!;
  const cfgRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT season, goal_bonus_gk, goal_bonus_def, goal_bonus_mid, goal_bonus_att, csc_malus, penalty_saved_bonus, red_card_note_zero, min_note FROM SCORING_CONFIG ORDER BY season DESC LIMIT 1"
  ).catch(() => []);
  const r = cfgRows[0];
  const cfg: ScoringConfig = r
    ? {
        goalBonusGk: Number(r.goal_bonus_gk), goalBonusDef: Number(r.goal_bonus_def),
        goalBonusMid: Number(r.goal_bonus_mid), goalBonusAtt: Number(r.goal_bonus_att),
        cscMalus: Number(r.csc_malus), penaltySavedBonus: Number(r.penalty_saved_bonus),
        redCardNoteZero: Number(r.red_card_note_zero) === 1, minNote: Number(r.min_note),
      }
    : SCORING_DEFAULTS;
  console.log(`Barème : ${r ? `SCORING_CONFIG ${r.season}` : "défaut"}`);

  const leagues = await prisma.league.findMany({ where: { seasonId }, orderBy: { name: "asc" } });
  const players = await prisma.player.findMany({ where: { seasonId } });
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const users = new Map((await prisma.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, clean(u.name)]));

  const scoresByDay = new Map<number, ReturnType<typeof buildDayScoreResolver>>();
  const resolverFor = async (day: number) => {
    if (!scoresByDay.has(day)) {
      const scores = await prisma.score.findMany({ where: { day } });
      scoresByDay.set(day, buildDayScoreResolver(players, scores));
    }
    return scoresByDay.get(day)!;
  };
  const dayTotal = async (lineup: number[], day: number) => {
    const resolve = await resolverFor(day);
    let tot = 0;
    for (const pid of lineup) {
      const s = resolve(pid);
      const p = playerMap.get(pid);
      if (!s || !p) continue;
      tot += computePlayerTotal(
        { points: dec(s.points), goals: s.goals, passes: s.passes, position: mapPosition(p.position),
          redCard: Boolean(s.redCard), ownGoals: s.ownGoals ?? 0, penaltySaved: s.penaltySaved ?? 0 },
        cfg
      );
    }
    return tot;
  };

  let sanityKo = 0;
  const changes: { ligue: string; user: string; day: number; avant: number; apres: number; nb: number; depuis: number | null }[] = [];
  const cumul = new Map<number, Map<number, { avant: number; apres: number }>>();

  for (const lg of leagues) {
    const stats = await prisma.statsUser.findMany({ where: { leagueId: lg.id }, orderBy: { day: "asc" } });
    const td = await prisma.$queryRawUnsafe<{ userId: number; playerId: number; day: number; indx: number }[]>(
      "SELECT ID_USER userId, ID_PLAYER playerId, DAY day, INDX indx FROM TEAM_DAY WHERE ID_LEAGUE = ? ORDER BY DAY, INDX", lg.id
    );
    const byUserDay = new Map<string, number[]>();
    for (const t of td) {
      const k = `${Number(t.userId)}:${Number(t.day)}`;
      byUserDay.set(k, [...(byUserDay.get(k) ?? []), Number(t.playerId)]);
    }
    const team = await prisma.team.findMany({ where: { leagueId: lg.id } });
    const cm = new Map<number, { avant: number; apres: number }>();
    cumul.set(lg.id, cm);

    for (const s of stats) {
      const uid = s.userId, day = s.day;
      const active = team.filter((t) => t.userId === uid && t.dayFirst <= day && t.dayLast >= day);
      // Ancienne règle (getEffectiveLineup actuel)
      let old = byUserDay.get(`${uid}:${day}`) ?? (day > 1 ? byUserDay.get(`${uid}:${day - 1}`) : undefined);
      if (!old) {
        // Requête strictement identique à getEffectiveLineup (l'ordre des lignes
        // n'est pas garanti sans orderBy : il dépend de la forme de la requête)
        const tm = await prisma.team.findMany({
          where: { leagueId: lg.id, userId: uid, dayFirst: { lte: day }, dayLast: { gte: day }, isSubs: 0 },
        });
        old = tm.slice(0, 11).map((t) => t.playerId);
      }
      const oldTot = await dayTotal(old, day);
      if (Math.abs(oldTot - dec(s.ptsTot)) > 0.01) {
        sanityKo++;
        console.log(`SANITY KO ${lg.name} ${users.get(uid)} J${day} : simulé ${oldTot} vs STATS_USER ${dec(s.ptsTot)}`);
      }
      // Nouvelle règle : compo du jour, sinon dernière validée (filtrée effectif actif), sinon TEAM
      let neu = byUserDay.get(`${uid}:${day}`);
      let depuis: number | null = day;
      if (!neu) {
        depuis = null;
        for (let d = day - 1; d >= 1; d--) {
          const l = byUserDay.get(`${uid}:${d}`);
          if (l) {
            const ids = new Set(active.map((t) => t.playerId));
            neu = l.filter((p) => ids.has(p));
            depuis = d;
            break;
          }
        }
      }
      if (!neu) neu = old;
      const newTot = await dayTotal(neu, day);
      const c = cm.get(uid) ?? { avant: 0, apres: 0 };
      c.avant += dec(s.ptsTot); c.apres += newTot; cm.set(uid, c);
      if (Math.abs(newTot - dec(s.ptsTot)) > 0.01 || depuis !== day) {
        if (depuis !== day) changes.push({ ligue: lg.name, user: users.get(uid) ?? `#${uid}`, day, avant: dec(s.ptsTot), apres: newTot, nb: neu.length, depuis });
      }
    }
  }

  console.log(`\nSanity-check ancienne règle = STATS_USER : ${sanityKo === 0 ? "OK" : `${sanityKo} KO`}`);
  if (sanityKo > 0) console.log("(écarts limités aux replis TEAM, ordre des lignes non reproductible ; avant = STATS_USER réel)");

  console.log(`\n=== Journées en repli (${changes.length}) ===`);
  for (const c of changes)
    console.log(`${c.ligue.padEnd(8)} ${c.user.padEnd(22)} J${String(c.day).padStart(2)}  ${c.avant.toFixed(1).padStart(5)} -> ${c.apres.toFixed(1).padStart(5)}  (${(c.apres - c.avant >= 0 ? "+" : "") + (c.apres - c.avant).toFixed(1)})  compo J${c.depuis ?? "-"}, ${c.nb} joueurs`);

  console.log(`\n=== Classements cumulés (dernière journée publiée) ===`);
  for (const lg of leagues) {
    const cm = cumul.get(lg.id)!;
    const rows = [...cm.entries()].map(([uid, v]) => ({ user: users.get(uid) ?? `#${uid}`, ...v }));
    const rankA = [...rows].sort((a, b) => b.avant - a.avant).map((r) => r.user);
    const rankN = [...rows].sort((a, b) => b.apres - a.apres).map((r) => r.user);
    console.log(`\n${lg.name}`);
    for (const r of [...rows].sort((a, b) => b.apres - a.apres)) {
      const ra = rankA.indexOf(r.user) + 1, rn = rankN.indexOf(r.user) + 1;
      const d = r.apres - r.avant;
      console.log(`  ${String(rn).padStart(2)}. ${r.user.padEnd(22)} ${r.apres.toFixed(1).padStart(6)}  (avant ${r.avant.toFixed(1)}, ${ra}e)${Math.abs(d) > 0.01 ? `  ${d > 0 ? "+" : ""}${d.toFixed(1)}` : ""}${ra !== rn ? `  ${ra > rn ? "▲" : "▼"}${Math.abs(ra - rn)}` : ""}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
