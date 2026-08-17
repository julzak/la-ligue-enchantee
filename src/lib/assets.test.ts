import { describe, it, expect } from "vitest";
import { canonicalClubKey, getClubLogoUrlByName, getClubShortNameByName } from "./assets";

// Les 19 noms EXACTS de la table CLUB en prod pour la saison 2026-2027
// (importés depuis football-data.org). C'est le jeu de données qui a révélé le
// bug signalé par Laurent : 13 de ces clubs n'avaient plus de logo.
const CLUBS_2026_2027 = [
  "AJ Auxerre", "Angers SCO", "AS Monaco FC", "ES Troyes AC", "FC Lorient",
  "Le Havre AC", "Le Mans FC", "Légion étrangère", "Lille OSC", "OGC Nice",
  "Olympique de Marseille", "Olympique Lyonnais", "Paris FC",
  "Paris Saint-Germain FC", "Racing Club de Lens", "RC Strasbourg Alsace",
  "Stade Brestois 29", "Stade Rennais FC 1901", "Toulouse FC",
];

describe("assets — clubs de la saison courante", () => {
  it("chaque club de la saison a un logo (promus inclus)", () => {
    const sansLogo = CLUBS_2026_2027.filter((n) => getClubLogoUrlByName(n) === null);
    expect(sansLogo).toEqual([]);
  });

  it("chaque logo référencé existe dans public/clubs/", async () => {
    const fs = await import("fs");
    const path = await import("path");
    for (const name of CLUBS_2026_2027) {
      const logo = getClubLogoUrlByName(name)!;
      expect(fs.existsSync(path.join(process.cwd(), "public", logo)), `${name} -> ${logo}`).toBe(true);
    }
  });

  it("chaque club a un trigramme, jamais le nom brut en repli", () => {
    for (const name of CLUBS_2026_2027) {
      const short = getClubShortNameByName(name);
      expect(short, name).not.toBe(name);
      expect(short.length, name).toBeLessThanOrEqual(5);
    }
  });

  it("les noms longs se rattachent au même club que les noms courts", () => {
    // SANITY-CHECK du bug : avant le correctif, la forme longue de
    // football-data.org ne tombait sur aucune entrée et produisait sa propre
    // clé, distincte de celle du calendrier TheSportsDB. Les deux formes
    // doivent désormais donner exactement la même clé canonique.
    const paires: [string, string][] = [
      ["AS Monaco FC", "Monaco"],
      ["Lille OSC", "Lille"],
      ["Olympique de Marseille", "Marseille"],
      ["Racing Club de Lens", "Lens"],
      ["RC Strasbourg Alsace", "Strasbourg"],
      ["Stade Brestois 29", "Brest"],
      ["Stade Rennais FC 1901", "Rennes"],
      ["Paris Saint-Germain FC", "Paris Saint-Germain"],
      ["Toulouse FC", "Toulouse"],
      ["Le Havre AC", "Le Havre"],
      ["FC Lorient", "Lorient"],
      ["ES Troyes AC", "Troyes"],
      ["Le Mans FC", "Le Mans"],
    ];
    for (const [long, court] of paires) {
      expect(canonicalClubKey(long), `${long} vs ${court}`).toBe(canonicalClubKey(court));
    }
  });
});

describe("assets — pièges d'identification", () => {
  it("ne confond jamais le Paris FC et le Paris Saint-Germain", () => {
    // Deux clubs parisiens : la normalisation agressive ne doit pas les fusionner.
    expect(canonicalClubKey("Paris FC")).toBe("PARIS FC");
    expect(canonicalClubKey("Paris Saint-Germain FC")).toBe("PARIS SG");
    expect(canonicalClubKey("Paris SG")).toBe("PARIS SG");
    expect(getClubLogoUrlByName("Paris FC")).toBe("/clubs/parisfc.png");
    expect(getClubLogoUrlByName("Paris Saint-Germain FC")).toBe("/clubs/psg.png");
  });

  it("ne confond jamais Le Havre et Le Mans", () => {
    expect(canonicalClubKey("Le Havre AC")).toBe("LE HAVRE");
    expect(canonicalClubKey("Le Mans FC")).toBe("LE MANS");
  });

  it("absorbe une variante inédite grâce au repli sur les mots discriminants", () => {
    // Filet pour le prochain fournisseur : ces libellés ne sont dans aucun alias.
    expect(canonicalClubKey("Football Club de Lorient")).toBe("LORIENT");
    expect(canonicalClubKey("Association Sportive de Monaco FC")).toBe("MONACO");
    expect(canonicalClubKey("Stade Brestois")).toBe("BREST");
  });

  it("garde les clubs des saisons passées (historique des fiches joueurs)", () => {
    expect(getClubLogoUrlByName("FC Metz")).toBe("/clubs/metz.png");
    expect(getClubLogoUrlByName("FC Nantes")).toBe("/clubs/nantes.png");
  });

  it("apparie les noms legacy à parenthèses de la table CLUB (écran notes)", () => {
    // Les fiches CLUB des saisons passées portent ces formes : l'écran de
    // saisie des notes rattache les joueurs aux matchs via la clé canonique.
    const paires: [string, string][] = [
      ["MARSEILLE (OM)", "Olympique de Marseille"],
      ["PARIS-SG (PSG)", "Paris Saint-Germain FC"],
      ["LYON (OL)", "Olympique Lyonnais"],
      ["MONACO (ASM)", "AS Monaco FC"],
    ];
    for (const [legacy, fd] of paires) {
      expect(canonicalClubKey(legacy), `${legacy} vs ${fd}`).toBe(canonicalClubKey(fd));
    }
  });

  it("un club inconnu ne reçoit pas le logo d'un autre", () => {
    expect(getClubLogoUrlByName("Clermont Foot 63")).toBeNull();
    expect(getClubShortNameByName("Clermont Foot 63", "CF63")).toBe("CF63");
  });
});
