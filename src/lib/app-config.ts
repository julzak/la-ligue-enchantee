import { prisma } from "./prisma";

// Configuration applicative clé/valeur (table APP_CONFIG). Sert aux clés API
// saisies par les admins : aucun changement ne nécessite SSH ni redéploiement.
// Pas de react.cache : utilisable aussi depuis les scripts CLI.

export const CONFIG_KEYS = {
  // Token gratuit football-data.org : listes de joueurs (noms + postes).
  FOOTBALL_DATA_TOKEN: "football_data_token",
  // Clé TheSportsDB premium (9$/mois, abonnement saisonnier) : photos.
  THESPORTSDB_PREMIUM_KEY: "thesportsdb_premium_key",
  // Date de saisie de la clé photos : alimente le rappel de résiliation.
  THESPORTSDB_KEY_SET_AT: "thesportsdb_premium_key_set_at",
} as const;

export async function getAppConfig(name: string): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { name } });
  const value = row?.value?.trim();
  return value ? value : null;
}

export async function setAppConfig(name: string, value: string | null): Promise<void> {
  await prisma.appConfig.upsert({
    where: { name },
    create: { name, value },
    update: { value },
  });
}
