import { describe, it, expect } from "vitest";
import { formatParticipantRecap, formatAllRecaps, type ParticipantRoundRecap } from "./auction-recap";

// Données de test canoniques
const baseRecap: ParticipantRoundRecap = {
  userName: "Troyan",
  round: 3,
  acquisitions: [
    { playerName: "Désiré Doué", position: "MIL", clubName: "Paris SG", amount: 12 },
    { playerName: "Bradley Barcola", position: "ATT", clubName: "Paris SG", amount: 14 },
  ],
  losses: [
    {
      playerName: "Nuno Mendes",
      position: "DEF",
      yourBid: 15,
      reasonType: "surenchere",
      detail: "obtenu par Dupont à 18 pts",
    },
    {
      playerName: "Gardiens Monaco",
      position: "G",
      yourBid: 8,
      reasonType: "tie",
      detail: "personne — égalité, remis en jeu au tour suivant",
      refund: 8,
    },
  ],
  removals: [
    {
      playerName: "Ludovic Ajorque",
      amount: 12,
      reason: "5 attaquants misés : retrait de l'acquisition la plus chère de la ligne (Ajorque, 12 pts).",
    },
  ],
  budgetRemaining: 44,
  playersWon: 9,
  playersPerUser: 13,
};

describe("formatParticipantRecap", () => {
  it("génère un bloc avec en-tête contenant le nom et le tour", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).toContain("Tour 3");
    expect(text).toContain("Troyan");
  });

  it("liste les acquisitions avec joueur, position, club et prix", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).toContain("ACQUISITIONS");
    expect(text).toContain("Désiré Doué");
    expect(text).toContain("MIL");
    expect(text).toContain("Paris SG");
    expect(text).toContain("12 pts");
    expect(text).toContain("Bradley Barcola");
    expect(text).toContain("14 pts");
  });

  it("liste les mises perdues avec raison — surenchère", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).toContain("MISES PERDUES");
    expect(text).toContain("Nuno Mendes");
    expect(text).toContain("Surenchéri");
    expect(text).toContain("obtenu par Dupont à 18 pts");
  });

  it("liste les mises perdues avec raison — égalité", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).toContain("Gardiens Monaco");
    expect(text).toContain("Égalité");
    expect(text).toContain("remis en jeu");
  });

  it("liste les retraits de pénalité avec motif complet", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).toContain("RETRAITS DE PÉNALITÉ");
    expect(text).toContain("Ludovic Ajorque");
    expect(text).toContain("5 attaquants misés");
    expect(text).toContain("12 pts");
  });

  it("affiche le budget restant", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).toContain("BUDGET RESTANT : 44 pts");
  });

  it("affiche la progression de l'effectif", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).toContain("EFFECTIF : 9 / 13 joueurs");
  });

  it("résultat sans acquisition — message dédié sans rubrique vide", () => {
    const noAcqRecap: ParticipantRoundRecap = {
      ...baseRecap,
      acquisitions: [],
      losses: [
        {
          playerName: "Kylian Mbappé",
          position: "ATT",
          yourBid: 30,
          reasonType: "surenchere",
          detail: "obtenu par Francis à 35 pts",
        },
      ],
      removals: [],
    };
    const text = formatParticipantRecap(noAcqRecap);
    expect(text).toContain("ACQUISITIONS : aucune ce tour.");
    expect(text).toContain("Kylian Mbappé");
    // Pas de rubrique RETRAITS si vide
    expect(text).not.toContain("RETRAITS DE PÉNALITÉ");
  });

  it("résultat sans perte ni retrait — message neutre", () => {
    const cleanRecap: ParticipantRoundRecap = {
      ...baseRecap,
      losses: [],
      removals: [],
    };
    const text = formatParticipantRecap(cleanRecap);
    expect(text).toContain("Aucune mise perdue ni retrait ce tour.");
  });

  it("sortie en texte brut (aucun HTML, aucun markdown)", () => {
    const text = formatParticipantRecap(baseRecap);
    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).not.toMatch(/\*\*|__|~~|```/);
  });
});

describe("formatAllRecaps", () => {
  it("concatène les récaps de plusieurs participants avec séparateur", () => {
    const second: ParticipantRoundRecap = {
      ...baseRecap,
      userName: "GeLo 59",
      round: 3,
      acquisitions: [{ playerName: "Andy Diouf", position: "MIL", clubName: "Lens", amount: 8 }],
      losses: [],
      removals: [],
      budgetRemaining: 60,
      playersWon: 5,
    };
    const text = formatAllRecaps([baseRecap, second]);
    expect(text).toContain("Troyan");
    expect(text).toContain("GeLo 59");
    expect(text).toContain("---");
  });

  it("retourne un texte vide pour une liste vide", () => {
    expect(formatAllRecaps([])).toBe("");
  });

  it("un seul participant — pas de séparateur superflu", () => {
    const text = formatAllRecaps([baseRecap]);
    expect(text).not.toContain("---");
  });
});

// ── Tests de sélection de tour ─────────────────────────────────────────────

describe("sélection du tour par défaut (logique déterministe)", () => {
  /**
   * La sélection du tour "par défaut" est calculée côté API :
   *   selectedRound = requestedRound si valide, sinon dernier tour dépouillé.
   * On teste ici la même logique en pur TS (sans DB).
   */
  function selectRound(resolvedRounds: number[], requested: number | null): number | null {
    if (requested !== null && resolvedRounds.includes(requested)) return requested;
    return resolvedRounds.length > 0 ? resolvedRounds[resolvedRounds.length - 1] : null;
  }

  it("retourne null si aucun tour dépouillé et aucun tour demandé", () => {
    expect(selectRound([], null)).toBeNull();
  });

  it("retourne le dernier tour dépouillé par défaut", () => {
    expect(selectRound([1, 2, 3], null)).toBe(3);
  });

  it("retourne le tour demandé s'il est dépouillé", () => {
    expect(selectRound([1, 2, 3], 2)).toBe(2);
  });

  it("ignore un tour demandé non encore dépouillé, retourne le dernier dépouillé", () => {
    expect(selectRound([1, 2], 5)).toBe(2);
  });

  it("gère un seul tour dépouillé", () => {
    expect(selectRound([1], null)).toBe(1);
    expect(selectRound([1], 1)).toBe(1);
  });
});
