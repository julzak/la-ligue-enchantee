// État de soumission d'un participant pour le tour courant, tel qu'affiché dans
// la Console des enchères (admin). Couche PURE : la page ne fait qu'afficher.
//
// Demande Pierre Berthet (2026-08-14) : les participants dont l'effectif est
// DÉJÀ COMPLET (13/13) restaient badgés « EN ATTENTE » et comptés dans le
// bandeau « X participant(s) sans soumission — seront traités selon le
// règlement au dépouillement ». Trompeur : ils n'ont plus rien à miser, rien
// n'est à récupérer chez eux au dépouillement. Ils restent VISIBLES et au
// dénominateur (« pour pas oublier »), mais avec un état distinct.
//
// Attention au piège du handoff : « effectif complet » (13 mises won, tous
// tours) et « a soumis ce tour » (mise du tour courant, statut != draft) sont
// deux choses différentes. Une soumission du tour courant prime toujours : un
// participant complet QUI a soumis reste « SOUMISE ».

export type SubmissionState =
  /** A soumis au moins une mise pour le tour courant. */
  | "submitted"
  /** Effectif déjà complet et aucune mise ce tour : plus rien à miser. */
  | "complete"
  /** N'a pas soumis et son effectif est incomplet : soumission attendue. */
  | "pending";

export interface SubmissionParticipant {
  /** Au moins une mise du tour courant (statut != 'draft'). */
  hasSubmitted: boolean;
  /** Nombre de mises won, TOUS tours confondus. */
  playersWon: number;
}

export function submissionState(
  participant: SubmissionParticipant,
  playersPerUser: number
): SubmissionState {
  if (participant.hasSubmitted) return "submitted";
  if (playersPerUser > 0 && participant.playersWon >= playersPerUser) return "complete";
  return "pending";
}

export interface SubmissionSummary<T> {
  /** Ont soumis ce tour. */
  submitted: T[];
  /** Effectif complet, sans mise ce tour. */
  complete: T[];
  /** Soumission encore attendue (le seul groupe à relancer). */
  pending: T[];
  /** Tous les participants de la ligue : dénominateur du compteur « X / N ». */
  total: number;
}

export function summarizeSubmissions<T extends SubmissionParticipant>(
  participants: T[],
  playersPerUser: number
): SubmissionSummary<T> {
  const summary: SubmissionSummary<T> = {
    submitted: [],
    complete: [],
    pending: [],
    total: participants.length,
  };
  for (const p of participants) {
    summary[submissionState(p, playersPerUser)].push(p);
  }
  return summary;
}
