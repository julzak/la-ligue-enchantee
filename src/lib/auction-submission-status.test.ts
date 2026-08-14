// Tests de l'état de soumission affiché dans la Console des enchères.
// Contrat (demande Pierre Berthet, 2026-08-14) :
//   - 100% des participants de la ligue restent listés, effectifs complets inclus ;
//   - un effectif complet sans mise ce tour n'est PAS « en attente de soumission » ;
//   - une soumission du tour courant prime sur tout le reste.

import { describe, it, expect } from "vitest";
import {
  submissionState,
  summarizeSubmissions,
  type SubmissionParticipant,
} from "./auction-submission-status";

const PLAYERS_PER_USER = 13;

function participant(overrides: Partial<SubmissionParticipant> = {}): SubmissionParticipant {
  return { hasSubmitted: false, playersWon: 0, ...overrides };
}

describe("état de soumission d'un participant (tour courant)", () => {
  it("a soumis ce tour → SOUMISE", () => {
    expect(submissionState(participant({ hasSubmitted: true, playersWon: 4 }), PLAYERS_PER_USER))
      .toBe("submitted");
  });

  it("effectif incomplet et rien soumis → EN ATTENTE", () => {
    expect(submissionState(participant({ playersWon: 12 }), PLAYERS_PER_USER)).toBe("pending");
  });

  it("effectif complet (13/13) et rien soumis → COMPLET, pas EN ATTENTE", () => {
    expect(submissionState(participant({ playersWon: 13 }), PLAYERS_PER_USER)).toBe("complete");
  });

  it("effectif complet MAIS a soumis ce tour → SOUMISE (la soumission prime)", () => {
    // Cas réel : un effectif à 13 peut encore soumettre pour confirmer (M2).
    expect(submissionState(participant({ hasSubmitted: true, playersWon: 13 }), PLAYERS_PER_USER))
      .toBe("submitted");
  });

  it("plus de 13 acquis (ajout admin au prix, PR #56) → COMPLET", () => {
    expect(submissionState(participant({ playersWon: 14 }), PLAYERS_PER_USER)).toBe("complete");
  });

  it("playersPerUser incohérent (0) → jamais COMPLET par accident", () => {
    expect(submissionState(participant({ playersWon: 0 }), 0)).toBe("pending");
  });

  // SANITY-CHECK : prouve que ces tests détectent la régression qu'ils gardent.
  // Comportement d'origine (avant 2026-08-14) = « pending dès que !hasSubmitted »,
  // qui rangeait un effectif complet parmi les soumissions attendues.
  it("sanity-check : l'ancien calcul (pending si !hasSubmitted) échouerait ici", () => {
    const buggy = (p: SubmissionParticipant) => (p.hasSubmitted ? "submitted" : "pending");
    const complet = participant({ playersWon: 13 });
    expect(buggy(complet)).toBe("pending");
    expect(submissionState(complet, PLAYERS_PER_USER)).not.toBe(buggy(complet));
  });
});

describe("récapitulatif des soumissions d'un tour", () => {
  const participants = [
    participant({ hasSubmitted: true, playersWon: 5 }),   // soumise
    participant({ hasSubmitted: true, playersWon: 13 }),  // soumise (complet qui confirme)
    participant({ playersWon: 13 }),                      // complet, rien soumis
    participant({ playersWon: 7 }),                       // en attente
    participant({ playersWon: 0 }),                       // en attente
  ];

  it("répartit les participants en trois groupes disjoints", () => {
    const s = summarizeSubmissions(participants, PLAYERS_PER_USER);
    expect(s.submitted).toHaveLength(2);
    expect(s.complete).toHaveLength(1);
    expect(s.pending).toHaveLength(2);
  });

  it("le dénominateur reste 100% des participants de la ligue", () => {
    // Critère d'acceptation : aucun participant n'est masqué ni retiré du compteur.
    const s = summarizeSubmissions(participants, PLAYERS_PER_USER);
    expect(s.total).toBe(participants.length);
    expect(s.submitted.length + s.complete.length + s.pending.length).toBe(s.total);
  });

  it("le groupe à relancer exclut les effectifs complets", () => {
    const s = summarizeSubmissions(participants, PLAYERS_PER_USER);
    expect(s.pending.every((p) => p.playersWon < PLAYERS_PER_USER)).toBe(true);
  });

  it("ligue vide → aucun groupe, total 0 (pas de division par zéro en amont)", () => {
    const s = summarizeSubmissions([], PLAYERS_PER_USER);
    expect(s.total).toBe(0);
    expect(s.pending).toEqual([]);
  });
});
