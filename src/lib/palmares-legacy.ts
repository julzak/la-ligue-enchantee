// Palmarès historique codé en dur AVANT la machine à saisons.
// FALLBACK pour la page publique tant que la table PALMARES n'est pas remplie
// (import CSV one-shot via scripts/import-palmares.ts). Dès qu'une année+division
// existe en base, la base prime et l'entrée legacy correspondante est ignorée
// (dédup par couple year+divisionLabel dans src/lib/palmares.ts).
//
// DONNÉES REPRISES VERBATIM de l'ancienne page /palmares (constantes
// CHAMPIONNATS / COUPE). Ne rien inventer : si une année manque ici, c'est
// qu'elle manquait dans la source.

export interface LegacyPalmaresEntry {
  year: string;
  divisionLabel: string;
  position: string; // "1" = champion de division ; "Vainqueur" = coupe
  pseudo: string;
}

export const LEGACY_PALMARES: LegacyPalmaresEntry[] = [
  // ── Ligue 1 ──
  { year: "2024", divisionLabel: "Ligue 1", position: "1", pseudo: "Thib" },
  { year: "2023", divisionLabel: "Ligue 1", position: "1", pseudo: "Martial" },
  { year: "2022", divisionLabel: "Ligue 1", position: "1", pseudo: "Zenigata" },
  { year: "2021", divisionLabel: "Ligue 1", position: "1", pseudo: "Dimitri S" },
  { year: "2020", divisionLabel: "Ligue 1", position: "1", pseudo: "Nénéfin" },
  { year: "2019", divisionLabel: "Ligue 1", position: "1", pseudo: "ElioMM" },
  { year: "2018", divisionLabel: "Ligue 1", position: "1", pseudo: "Martial" },
  { year: "2017", divisionLabel: "Ligue 1", position: "1", pseudo: "Zenigata" },
  { year: "2016", divisionLabel: "Ligue 1", position: "1", pseudo: "Shima / Jay" },
  { year: "2015", divisionLabel: "Ligue 1", position: "1", pseudo: "Remy / Raf" },
  { year: "2014", divisionLabel: "Ligue 1", position: "1", pseudo: "Wino" },
  // ── Ligue 2 ──
  { year: "2024", divisionLabel: "Ligue 2", position: "1", pseudo: "Arnoldo" },
  { year: "2023", divisionLabel: "Ligue 2", position: "1", pseudo: "Skippy" },
  { year: "2022", divisionLabel: "Ligue 2", position: "1", pseudo: "Bernard Lada" },
  { year: "2021", divisionLabel: "Ligue 2", position: "1", pseudo: "Lagolese" },
  { year: "2020", divisionLabel: "Ligue 2", position: "1", pseudo: "Skippy" },
  { year: "2019", divisionLabel: "Ligue 2", position: "1", pseudo: "Nums" },
  { year: "2018", divisionLabel: "Ligue 2", position: "1", pseudo: "Benhijk" },
  { year: "2017", divisionLabel: "Ligue 2", position: "1", pseudo: "Benhijk" },
  { year: "2016", divisionLabel: "Ligue 2", position: "1", pseudo: "Nums" },
  { year: "2015", divisionLabel: "Ligue 2", position: "1", pseudo: "Skaybi" },
  { year: "2014", divisionLabel: "Ligue 2", position: "1", pseudo: "Blek le Roc" },
  { year: "2013", divisionLabel: "Ligue 2", position: "1", pseudo: "Pili" },
  // ── Ligue 3 (ex-National 1) ──
  { year: "2024", divisionLabel: "Ligue 3", position: "1", pseudo: "Blek le Roc" },
  { year: "2023", divisionLabel: "Ligue 3", position: "1", pseudo: "Rom Aulas" },
  { year: "2022", divisionLabel: "Ligue 3", position: "1", pseudo: "Gelo 59" },
  { year: "2021", divisionLabel: "Ligue 3", position: "1", pseudo: "Vince77" },
  { year: "2020", divisionLabel: "Ligue 3", position: "1", pseudo: "Damoki Sakai" },
  { year: "2019", divisionLabel: "Ligue 3", position: "1", pseudo: "Troyan" },
  { year: "2018", divisionLabel: "Ligue 3", position: "1", pseudo: "Wicket" },
  { year: "2017", divisionLabel: "Ligue 3", position: "1", pseudo: "Troyan" },
  { year: "2016", divisionLabel: "Ligue 3", position: "1", pseudo: "Benhijk" },
  { year: "2015", divisionLabel: "Ligue 3", position: "1", pseudo: "Aelle" },
  { year: "2014", divisionLabel: "Ligue 3", position: "1", pseudo: "Nums" },
  { year: "2012", divisionLabel: "Ligue 3", position: "1", pseudo: "Douggy" },
  // ── Ligue 4 (ex-National 2) ──
  { year: "2019", divisionLabel: "Ligue 4", position: "1", pseudo: "Vince77" },
  { year: "2018", divisionLabel: "Ligue 4", position: "1", pseudo: "Kazu" },
  { year: "2017", divisionLabel: "Ligue 4", position: "1", pseudo: "Jun" },
  { year: "2016", divisionLabel: "Ligue 4", position: "1", pseudo: "Jo la Skeez" },
  { year: "2015", divisionLabel: "Ligue 4", position: "1", pseudo: "La Fripouille" },
  { year: "2014", divisionLabel: "Ligue 4", position: "1", pseudo: "Diamantinho" },
  { year: "2013", divisionLabel: "Ligue 4", position: "1", pseudo: "Thib" },
  // ── Ligue 5 (ex-National 3) ──
  { year: "2015", divisionLabel: "Ligue 5", position: "1", pseudo: "MadMax" },
  { year: "2014", divisionLabel: "Ligue 5", position: "1", pseudo: "Winogradsky" },
  // ── Coupe ──
  { year: "2024", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "GeLo 59" },
  { year: "2023", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Martial" },
  { year: "2022", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Nums" },
  { year: "2021", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "GeLo 59" },
  { year: "2019", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Vince77" },
  { year: "2018", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Kazu" },
  { year: "2017", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Kazu" },
  { year: "2016", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Benhijk" },
  { year: "2015", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Zenigata" },
  { year: "2014", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Laplante" },
  { year: "2013", divisionLabel: "Coupe", position: "Vainqueur", pseudo: "Thib" },
];
