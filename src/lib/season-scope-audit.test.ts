// Audit statique anti-résurgence de saison (signalement Pierre 2026-08-31 :
// la home affichait les matchs de la saison précédente).
//
// Principe : toute requête qui lit une table portant une colonne saison
// (season / ID_SEASON) doit la scoper, sinon les données de la saison
// précédente ressortent dans l'affichage. Ce test scanne src/ :
//  1. SQL brut ($queryRawUnsafe...) : chaque littéral SQL qui référence une
//     table à saison doit contenir une référence à la saison.
//  2. Prisma : les lectures de liste (findMany/count/groupBy) sur les modèles
//     à seasonId doivent être scopées (seasonId / getSeasonFilters / scope).
// Les cas légitimement non scopés sont dans ALLOWLIST, chacun justifié.
// Toute nouvelle requête non scopée fait échouer `npm test` et la CI.
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");

// Tables MySQL portant une colonne saison (source : information_schema,
// 2026-08-31). SEASON elle-même est exclue (c'est le référentiel).
const SEASON_TABLES = [
  "CLUB", "CUP", "JOKER_CONFIG", "LEAGUE", "MATCH_SCHEDULE", "MERCATO_CONFIG",
  "PALMARES", "PAYMENT", "PLAYER", "SCORING_CONFIG", "SEASON_MOVEMENT",
];
// \b suffit : "_" est un caractère de mot, donc \bCUP\b ne matche pas
// CUP_MATCH et \bLEAGUE\b ne matche pas ID_LEAGUE / LEAGUE_USER.
const TABLE_RE = new RegExp(
  String.raw`\b(?:FROM|JOIN|INTO|UPDATE)\s+(${SEASON_TABLES.join("|")})\b`,
  "i"
);
const SEASON_REF_RE = /season/i;

// Requêtes sûres sans scoping : filtrées/jointes par un ID (ID_PLAYER,
// ID_CLUB, id PK), car les IDs sont propres à chaque saison (l'import
// d'effectif recrée les lignes). Limite assumée : un sweep "FROM PLAYER"
// complet joint par id passerait ce filet ; le but est d'attraper les
// résurgences d'affichage, pas d'être une preuve formelle.
const SAFE_BY_ID_RE =
  /ID_PLAYER\s*(=|IN\b)|=\s*[\w.]*ID_PLAYER|ID_CLUB\s*=|=\s*[\w.]*ID_CLUB|WHERE\s+id\s*=\s*\?/i;

// Modèles Prisma portant seasonId. Les lectures de liste doivent être scopées.
const PRISMA_MODELS = ["league", "club", "player", "palmares", "seasonMovement"];
const PRISMA_READ_RE = new RegExp(
  String.raw`prisma\.(${PRISMA_MODELS.join("|")})\.(findMany|findFirst|count|groupBy|aggregate)\(`,
  "g"
);
// Fenêtre après l'appel dans laquelle on attend une trace de scoping.
const PRISMA_SCOPE_RE = /seasonId|getSeasonFilters|filters\.|scope\.|seasonScope|\bid:\s|\bid\s*:\s*{?\s*in\b/;
const PRISMA_WINDOW = 400;

// Cas non scopés assumés. Clé = chemin relatif à src/, valeur = fragments
// (un par occurrence tolérée) + justification en commentaire.
const SQL_ALLOWLIST: { file: string; contains: string; why: string }[] = [
  {
    file: "app/api/admin/cup/route.ts",
    contains: "SELECT * FROM CUP ORDER BY id DESC",
    why: "listing admin : montre les coupes de toutes les saisons (colonne season affichée)",
  },
  {
    file: "app/api/admin/cup/route.ts",
    contains: "SELECT id FROM CUP WHERE status = 'active'",
    why: "contrainte globale voulue : une seule coupe active toutes saisons confondues",
  },
  {
    file: "app/api/admin/players/route.ts",
    contains: "SELECT ID_CLUB, NAME FROM CLUB ORDER BY NAME",
    why: "branche fallback legacy (aucune saison scopée) ; la branche courante filtre ID_SEASON",
  },
];
const PRISMA_ALLOWLIST: { file: string; contains: string; why: string }[] = [
  {
    file: "app/api/admin/jokers/free/route.ts",
    contains: "prisma.player.findMany",
    why: "where construit plus haut avec getSeasonFilters().player",
  },
  {
    file: "app/api/admin/jokers/route.ts",
    contains: "prisma.club.findMany()",
    why: "clubMap par id, lookup uniquement depuis des joueurs déjà scopés saison",
  },
  {
    file: "app/api/jokers/route.ts",
    contains: "prisma.club.findMany()",
    why: "clubMap par id, lookup uniquement depuis des joueurs déjà scopés saison",
  },
  {
    file: "lib/palmares.ts",
    contains: "prisma.palmares.findMany",
    why: "le palmarès est volontairement multi-saisons (historique)",
  },
];

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listFiles(p);
    if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) return [p];
    return [];
  });
}

// Extraction naïve des littéraux chaîne (backticks, doubles, simples).
// Suffisant pour des SQL écrits en littéral, ce qui est la convention du repo.
function extractStrings(source: string): string[] {
  const out: string[] = [];
  // `[\s\S]` plutôt que le flag `s` (dotAll) : la cible TS du projet (es5 par
  // défaut) le refuse au typecheck, et `matchAll` n'y est itérable que via Array.from.
  const re = /`(?:[^`\\]|\\[\s\S])*`|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'/g;
  for (const m of Array.from(source.matchAll(re))) out.push(m[0].slice(1, -1));
  return out;
}

type Finding = { file: string; snippet: string };

function auditSql(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const f of files) {
    const rel = path.relative(SRC, f);
    const src = fs.readFileSync(f, "utf8");
    for (const s of extractStrings(src)) {
      if (!TABLE_RE.test(s)) continue;
      if (!/\b(SELECT|UPDATE|DELETE|INSERT)\b/i.test(s)) continue;
      if (SEASON_REF_RE.test(s)) continue;
      if (SAFE_BY_ID_RE.test(s)) continue;
      if (SQL_ALLOWLIST.some((a) => rel === a.file && s.includes(a.contains))) continue;
      findings.push({ file: rel, snippet: s.replace(/\s+/g, " ").slice(0, 160) });
    }
  }
  return findings;
}

function auditPrisma(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const f of files) {
    const rel = path.relative(SRC, f);
    const src = fs.readFileSync(f, "utf8");
    for (const m of Array.from(src.matchAll(PRISMA_READ_RE))) {
      const window = src.slice(m.index!, m.index! + PRISMA_WINDOW);
      if (PRISMA_SCOPE_RE.test(window)) continue;
      if (PRISMA_ALLOWLIST.some((a) => rel === a.file && window.includes(a.contains))) continue;
      findings.push({ file: rel, snippet: window.replace(/\s+/g, " ").slice(0, 160) });
    }
  }
  return findings;
}

function format(findings: Finding[]): string {
  return findings.map((f) => `  ${f.file}: ${f.snippet}`).join("\n");
}

describe("audit statique : scoping saison", () => {
  const files = listFiles(SRC);

  it("sanity-check : le détecteur attrape le bug d'origine (home, MATCH_SCHEDULE sans saison)", () => {
    // Requête exacte de src/app/page.tsx avant le fix du 2026-08-31.
    const buggy =
      "SELECT home_team, away_team, home_score, away_score FROM MATCH_SCHEDULE WHERE matchday = ? AND home_score IS NOT NULL ORDER BY match_date";
    expect(TABLE_RE.test(buggy)).toBe(true);
    expect(SEASON_REF_RE.test(buggy)).toBe(false);
    // Et la version corrigée passe.
    const fixed = buggy.replace("WHERE matchday", "WHERE season = ? AND matchday");
    expect(SEASON_REF_RE.test(fixed)).toBe(true);
  });

  it("SQL brut : aucune requête sur une table à saison sans référence saison", () => {
    const findings = auditSql(files);
    expect(
      findings,
      `Requêtes SQL non scopées saison (scoper avec season = ? / ID_SEASON, ou justifier dans SQL_ALLOWLIST) :\n${format(findings)}`
    ).toEqual([]);
  });

  it("Prisma : aucune lecture de liste non scopée sur un modèle à seasonId", () => {
    const findings = auditPrisma(files);
    expect(
      findings,
      `Lectures Prisma non scopées saison (scoper avec seasonId / getSeasonFilters, ou justifier dans PRISMA_ALLOWLIST) :\n${format(findings)}`
    ).toEqual([]);
  });
});
