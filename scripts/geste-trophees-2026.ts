import { prisma } from "../src/lib/prisma";

// Geste one-shot post-saison 2025-2026 (demande Laurent, 2026-08-25) :
// 1. Retrait des trophées provisoires de la saison :
//    - feuille (champion_automne) des 1ers à la trêve : Blek le Roc, Francis Llacer, Troyan
//    - ballon d'or (Dembélé) : Nico C, Fox, Kuerten26
// 2. Attribution des trophées définitifs (palmarès saison ID 1, LABEL 2026) :
//    - étoile jaune (champion Ligue 1) : LST
//    - étoile rouge (champion Ligue 2) : Francis Llacer
//    - étoile noire (champion Ligue 3) : Troyan
//    - coupe : Batistuta
// Sémantique des couleurs confirmée par croisement PALMARES <-> USER.NAME
// (jaune=D1, rouge=D2, noire=D3, bleue=D4, verte=D5).

const DRY_RUN = process.argv.includes("--dry-run");

const REMOVALS: { userId: number; file: string }[] = [
  { userId: 190, file: "champion_automne" },
  { userId: 807, file: "champion_automne" },
  { userId: 1360, file: "champion_automne" },
  { userId: 193, file: "ballon_dor" },
  { userId: 1346, file: "ballon_dor" },
  { userId: 1318, file: "ballon_dor" },
];

const ADDITIONS: { userId: number; tag: string }[] = [
  { userId: 1429, tag: '<img src="/img/etoile_jaune.gif">' },
  { userId: 807, tag: '<img src="/img/etoile_rouge.gif">' },
  { userId: 1360, tag: '<img src="/img/etoile_noire.gif">' },
  { userId: 1444, tag: '<img src="/img/coupe.gif">' },
];

async function getName(userId: number): Promise<string> {
  const [u] = await prisma.$queryRawUnsafe<{ NAME: string }[]>(
    "SELECT NAME FROM USER WHERE ID_USER = ?", userId
  );
  if (!u) throw new Error(`Utilisateur #${userId} introuvable`);
  return u.NAME;
}

async function setName(userId: number, name: string) {
  if (DRY_RUN) return;
  await prisma.$executeRawUnsafe("UPDATE USER SET NAME = ? WHERE ID_USER = ?", name, userId);
}

async function main() {
  console.log(DRY_RUN ? "== DRY RUN ==" : "== APPLICATION ==");
  const touched = new Map<number, string>();

  for (const { userId, file } of REMOVALS) {
    const before = touched.get(userId) ?? await getName(userId);
    const regex = new RegExp(`\\s*<img[^>]*${file}[^>]*>`, "gi");
    if (!regex.test(before)) {
      console.log(`#${userId}: AUCUNE balise ${file} trouvée — ignoré (déjà retiré ?)`);
      continue;
    }
    const after = before.replace(regex, "").replace(/\s{2,}/g, " ").trim();
    touched.set(userId, after);
    console.log(`#${userId} retrait ${file}:\n  avant: ${before}\n  après: ${after}`);
  }

  for (const { userId, tag } of ADDITIONS) {
    const before = touched.get(userId) ?? await getName(userId);
    const after = `${before.trim()} ${tag}`;
    touched.set(userId, after);
    console.log(`#${userId} ajout ${tag}:\n  avant: ${before}\n  après: ${after}`);
  }

  for (const [userId, name] of touched) {
    await setName(userId, name);
  }
  console.log(DRY_RUN ? "\nDry run terminé, rien écrit." : `\n${touched.size} utilisateurs mis à jour.`);
}

main().finally(() => prisma.$disconnect());
