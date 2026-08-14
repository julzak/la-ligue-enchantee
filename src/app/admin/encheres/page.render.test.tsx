// @vitest-environment jsdom
//
// Test de rendu de la Console des enchères : vérifie à l'écran ce que la couche
// pure auction-submission-status garantit en logique (demande Pierre Berthet,
// 2026-08-14). Monte la vraie page avec un fetch mocké, sans base ni auth.
//
// Ce que ce test protège :
//   - 100% des participants restent listés, effectifs complets inclus ;
//   - un effectif complet sans mise ce tour est badgé COMPLET, pas EN ATTENTE ;
//   - il ne figure pas dans le bandeau « X participant(s) sans soumission » ;
//   - il reste au dénominateur du compteur « X / N soumissions ».

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import AdminEncheresPage from "@/app/admin/encheres/page";

const LEAGUE = { id: 24, dbId: 24, name: "Ligue 2", seasonStatus: "AUCTION" };

// Réplique de l'état de recette : tour 4, Joueur1 a soumis, Joueur2 est complet
// à 13/13 sans mise ce tour, Joueur3 est incomplet et n'a rien soumis.
const PARTICIPANTS = [
  { userId: 1461, userName: "Joueur1", budget: 60, playersWon: 5, playersNeeded: 8, hasSubmitted: true, rosterValid: false, rosterErrors: [], missingCount: 8, missingLines: "", proposals: [] },
  { userId: 1462, userName: "Joueur2", budget: 4, playersWon: 13, playersNeeded: 0, hasSubmitted: false, rosterValid: true, rosterErrors: [], missingCount: 0, missingLines: "", proposals: [] },
  { userId: 1463, userName: "Joueur3", budget: 90, playersWon: 4, playersNeeded: 9, hasSubmitted: false, rosterValid: false, rosterErrors: [], missingCount: 9, missingLines: "", proposals: [] },
];

function auctionPayload(status: "open" | "closed") {
  return {
    seasonLabel: "2026-2027",
    auction: {
      id: 4, leagueId: 24, status, currentRound: 4,
      budget: 130, playersPerUser: 13, roundDeadline: null, phaseClosed: false,
    },
    bids: [],
    allWonBids: [],
    participants: PARTICIPANTS,
    results: null,
  };
}

function mockFetch(status: "open" | "closed") {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/api/admin/jokers/leagues")
      ? { leagues: [LEAGUE] }
      : url.includes("/api/admin/auction")
        ? auctionPayload(status)
        : {};
    return { ok: true, json: async () => body } as Response;
  });
}

/** Monte la page et sélectionne la ligue (aucune ligue n'est choisie au départ). */
async function renderConsole(status: "open" | "closed") {
  vi.stubGlobal("fetch", mockFetch(status));
  render(<AdminEncheresPage />);
  const select = await screen.findByRole("combobox");
  await waitFor(() => expect(within(select).getByText("Ligue 2")).toBeDefined());
  fireEvent.change(select, { target: { value: "24" } });
  // Attend que l'état du tour soit rendu (le nom d'un participant n'est pas une
  // ancre fiable : en tour clôturé il est noyé dans une phrase).
  await screen.findAllByText(status === "open" ? "OUVERT" : "CLÔTURÉ");
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Console des enchères — suivi des soumissions (tour ouvert)", () => {
  it("liste 100% des participants, effectif complet inclus", async () => {
    await renderConsole("open");
    for (const name of ["Joueur1", "Joueur2", "Joueur3"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("l'effectif complet est badgé COMPLET 13/13, pas EN ATTENTE", async () => {
    await renderConsole("open");
    expect(screen.getByText("COMPLET 13/13")).toBeDefined();
    // Un seul EN ATTENTE : Joueur3. Sans le correctif, il y en aurait deux.
    expect(screen.getAllByText("EN ATTENTE")).toHaveLength(1);
    expect(screen.getAllByText("SOUMISE")).toHaveLength(1);
  });
});

describe("Console des enchères — suivi des soumissions (tour clôturé)", () => {
  it("le bandeau des relances ne cite que le participant réellement en attente", async () => {
    await renderConsole("closed");
    const bandeau = screen.getByText(/participant\(s\) sans soumission/);
    expect(bandeau.textContent).toContain("1 participant(s) sans soumission");
    const bloc = bandeau.parentElement as HTMLElement;
    expect(bloc.textContent).toContain("Joueur3");
    // SANITY-CHECK du correctif : avant, Joueur2 (13/13) était listé ici comme
    // « sera traité selon le règlement au dépouillement », ce qui est faux.
    expect(bloc.textContent).not.toContain("Joueur2");
  });

  it("les effectifs complets ont leur propre encart, sans relance", async () => {
    await renderConsole("closed");
    const encart = screen.getByText(/effectif\(s\) complet\(s\), sans mise ce tour/);
    expect(encart.textContent).toContain("1 effectif(s) complet(s)");
    expect((encart.parentElement as HTMLElement).textContent).toContain("Joueur2");
  });

  it("le compteur garde tous les participants au dénominateur", async () => {
    await renderConsole("closed");
    // 1 soumission (Joueur1) sur 3 participants : l'effectif complet reste compté.
    expect(screen.getByText("1 / 3")).toBeDefined();
    expect(screen.getByText(/dont 1 effectif\(s\) déjà complet\(s\)/)).toBeDefined();
  });
});
