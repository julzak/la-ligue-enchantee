// Moteur de dépouillement des enchères : implémentation PURE du règlement
// docs/regles-encheres.md (sections 3.1, 3.2, 4). Zéro dépendance DB ou
// React : importable par les routes ET par les scripts de test CLI.
//
// Toute divergence entre ce fichier et docs/regles-encheres.md est un bug à
// corriger ICI (le règlement fait foi). Les 7 tests du contrat
// (scripts/test-encheres-*.ts) doivent passer avant tout déploiement.

export type Line = "GK" | "DEF" | "MID" | "ATT";

export interface EnginePlayer {
  id: number;
  lastName: string; // pour l'ordre alphabétique des retraits (règle 3.2.c.2)
  line: Line;
}

export interface ParticipantInput {
  userId: number;
  budget: number; // points disponibles au début du tour (130 - acquis cumulés)
  owned: EnginePlayer[]; // acquis des tours précédents (reportés sans mise, règle 3.1)
  bids: { player: EnginePlayer; amount: number }[]; // nouvelles mises du tour
}

export interface Acquisition {
  userId: number;
  player: EnginePlayer;
  amount: number;
}

export interface Removal extends Acquisition {
  reason: string;
}

export interface RoundOutcome {
  acquisitions: Acquisition[]; // acquisitions finales du tour (après retraits)
  removals: Removal[]; // retraits de pénalité, avec motif (règle 3.2.c)
  ties: { playerId: number; amount: number; userIds: number[] }[]; // personne ne l'obtient (règle 3.2.a)
  lostBids: { userId: number; playerId: number; amount: number }[]; // mise battue
  budgetsAfter: Map<number, number>; // budget restant par participant (règle 3.2.b)
  notes: string[]; // signaux non pénalisés (ex: budget non dépensé en entier)
}

// ── Soumission : acceptation (règle 3.1 + amendement 2026-06-10) ──────────
// Le tour doit être ouvert. Si une heure butoir est renseignée, toute
// soumission strictement postérieure est rejetée, tolérance zéro : pas de
// report au tour suivant.
export function acceptSubmission(input: {
  roundOpen: boolean;
  deadline: Date | null;
  submittedAt: Date;
}): { accepted: boolean; reason: string | null } {
  if (!input.roundOpen) {
    return { accepted: false, reason: "Tour fermé" };
  }
  if (input.deadline && input.submittedAt.getTime() > input.deadline.getTime()) {
    return { accepted: false, reason: "Soumission après l'heure butoir" };
  }
  return { accepted: true, reason: null };
}

// ── Validation d'une mise (avertissements UI, AVANT deadline) ─────────────
// Mêmes règles que les pénalités du dépouillement : permet de prévenir le
// participant avant qu'il soit trop tard. Ne bloque pas la soumission
// (le règlement pénalise au dépouillement, il n'interdit pas de soumettre).
export function validateSubmission(
  owned: EnginePlayer[],
  bids: { player: EnginePlayer; amount: number }[],
  budget: number
): string[] {
  const warnings: string[] = [];
  const squad = [...owned, ...bids.map((b) => b.player)];
  const count = (line: Line) => squad.filter((p) => p.line === line).length;

  if (count("GK") === 0) warnings.push("Aucun gardien dans la mise (pénalité : retrait d'1 joueur)");
  if (count("DEF") > 6) warnings.push(`${count("DEF")} défenseurs (max 6) : retrait des défenseurs en excès`);
  if (count("MID") > 6) warnings.push(`${count("MID")} milieux (max 6) : retrait des milieux en excès`);
  if (count("ATT") > 4) warnings.push(`${count("ATT")} attaquants (max 4) : retrait des attaquants en excès`);
  if (squad.length < 13) warnings.push(`${squad.length} joueurs misés (acquis inclus) au lieu de 13 : retrait d'autant de joueurs que de manquants`);
  if (squad.length > 13) warnings.push(`${squad.length} joueurs misés (acquis inclus) au lieu de 13 : retrait d'autant de joueurs que d'excédents`);

  const total = bids.reduce((s, b) => s + b.amount, 0);
  if (total > budget) warnings.push(`Total des mises (${total}) supérieur au budget disponible (${budget}) : retrait d'1 joueur`);

  return warnings;
}

// ── Dépouillement d'un tour (règle 3.2) ───────────────────────────────────
export function resolveRound(participants: ParticipantInput[]): RoundOutcome {
  const notes: string[] = [];

  // a) Attribution des joueurs : plus haute mise gagne, égalité = personne.
  const bidsByPlayer = new Map<number, { userId: number; player: EnginePlayer; amount: number }[]>();
  for (const p of participants) {
    for (const b of p.bids) {
      const arr = bidsByPlayer.get(b.player.id) ?? [];
      arr.push({ userId: p.userId, player: b.player, amount: b.amount });
      bidsByPlayer.set(b.player.id, arr);
    }
  }

  const provisional = new Map<number, Acquisition[]>(); // par userId, acquisitions du tour
  const ties: RoundOutcome["ties"] = [];
  const lostBids: RoundOutcome["lostBids"] = [];

  for (const playerBids of Array.from(bidsByPlayer.values())) {
    const sorted = [...playerBids].sort((a, b) => b.amount - a.amount);
    const top = sorted[0].amount;
    const topBidders = sorted.filter((b) => b.amount === top);

    if (topBidders.length === 1) {
      const winner = topBidders[0];
      const arr = provisional.get(winner.userId) ?? [];
      arr.push({ userId: winner.userId, player: winner.player, amount: winner.amount });
      provisional.set(winner.userId, arr);
      for (const loser of sorted.slice(1)) {
        lostBids.push({ userId: loser.userId, playerId: loser.player.id, amount: loser.amount });
      }
    } else {
      // Égalité de mise maximale : personne ne l'obtient, points rendus à
      // tous, joueur remis en jeu au tour suivant (règle 3.2.a).
      ties.push({
        playerId: sorted[0].player.id,
        amount: top,
        userIds: topBidders.map((b) => b.userId),
      });
      for (const loser of sorted.slice(topBidders.length)) {
        lostBids.push({ userId: loser.userId, playerId: loser.player.id, amount: loser.amount });
      }
    }
  }

  // c) Pénalités de composition, appliquées sur les acquisitions DU TOUR.
  // La "mise" évaluée = acquis des tours précédents + mises du tour
  // (les acquis sont reportés automatiquement dans la mise, règle 3.1).
  const removals: Removal[] = [];

  for (const p of participants) {
    const submitted = [...p.owned, ...p.bids.map((b) => b.player)];
    const countLine = (line: Line) => submitted.filter((pl) => pl.line === line).length;
    const totalBid = p.bids.reduce((s, b) => s + b.amount, 0);

    // Liste ordonnée des pénalités (ordre du tableau de la règle 3.2.c).
    const penalties: { count: number; line: Line | null; reason: string }[] = [];
    if (p.bids.length > 0 && countLine("GK") === 0) {
      penalties.push({ count: 1, line: null, reason: "Absence de gardien dans la mise" });
    }
    if (countLine("DEF") > 6) {
      penalties.push({ count: countLine("DEF") - 6, line: "DEF", reason: "Défenseurs en excès dans la mise" });
    }
    if (countLine("MID") > 6) {
      penalties.push({ count: countLine("MID") - 6, line: "MID", reason: "Milieux en excès dans la mise" });
    }
    if (countLine("ATT") > 4) {
      penalties.push({ count: countLine("ATT") - 4, line: "ATT", reason: "Attaquants en excès dans la mise" });
    }
    if (p.bids.length > 0 && submitted.length < 13) {
      penalties.push({ count: 13 - submitted.length, line: null, reason: "Moins de 13 joueurs misés" });
    }
    if (submitted.length > 13) {
      penalties.push({ count: submitted.length - 13, line: null, reason: "Plus de 13 joueurs misés" });
    }
    if (totalBid > p.budget) {
      penalties.push({ count: 1, line: null, reason: "Total des mises supérieur au budget disponible" });
    }
    if (totalBid < p.budget && submitted.length < 13 && p.bids.length > 0) {
      notes.push(`Participant ${p.userId} : budget non entièrement misé (perte sèche potentielle, sans pénalité)`);
    }

    // Application des retraits sur les acquisitions du tour : toujours la
    // plus chère d'abord, ordre alphabétique (nom) en cas d'égalité ; pour
    // les excès de ligne, uniquement dans la ligne concernée. Jamais plus de
    // retraits que d'acquisitions : aucune dette (règle 3.2.c.4).
    const acquired = provisional.get(p.userId) ?? [];
    for (const penalty of penalties) {
      for (let i = 0; i < penalty.count; i++) {
        const eligible = acquired
          .filter((a) => (penalty.line ? a.player.line === penalty.line : true))
          .sort(
            (a, b) =>
              b.amount - a.amount ||
              a.player.lastName.localeCompare(b.player.lastName, "fr")
          );
        if (eligible.length === 0) break; // pas de dette
        const removed = eligible[0];
        acquired.splice(acquired.indexOf(removed), 1);
        removals.push({ ...removed, reason: penalty.reason });
      }
    }
    provisional.set(p.userId, acquired);
  }

  // b) Restitution des points : seules les acquisitions finales décomptent.
  // budget_N+1 = budget_N - somme(mises sur joueurs obtenus au tour N).
  const acquisitions: Acquisition[] = [];
  const budgetsAfter = new Map<number, number>();
  for (const p of participants) {
    const acquired = provisional.get(p.userId) ?? [];
    acquisitions.push(...acquired);
    budgetsAfter.set(p.userId, p.budget - acquired.reduce((s, a) => s + a.amount, 0));
  }

  return { acquisitions, removals, ties, lostBids, budgetsAfter, notes };
}

// ── Fin de phase : complétion d'office à 1 point (règle 4) ────────────────
// L'admin choisit les joueurs ; le moteur vérifie seulement que le joueur
// complète l'effectif sans casser les quotas.
export function canCompleteWith(
  owned: EnginePlayer[],
  candidate: EnginePlayer
): { ok: boolean; reason: string | null } {
  if (owned.length >= 13) return { ok: false, reason: "Effectif déjà complet (13 joueurs)" };
  const count = (line: Line) => owned.filter((p) => p.line === line).length;
  const max: Record<Line, number> = { GK: 1, DEF: 6, MID: 6, ATT: 4 };
  if (count(candidate.line) >= max[candidate.line]) {
    return { ok: false, reason: `Quota ${candidate.line} atteint (${max[candidate.line]})` };
  }
  return { ok: true, reason: null };
}

// Validation de l'effectif final (règle 2.1) : 13 joueurs, 1 GK exactement,
// 3-6 DEF, 3-6 MIL, 1-4 ATT. Utilisée en fin de phase.
export function validateFinalRoster(owned: EnginePlayer[]): string[] {
  const errors: string[] = [];
  const count = (line: Line) => owned.filter((p) => p.line === line).length;
  if (owned.length !== 13) errors.push(`${owned.length} joueurs au lieu de 13`);
  if (count("GK") !== 1) errors.push(`${count("GK")} gardien(s) au lieu de 1`);
  if (count("DEF") < 3 || count("DEF") > 6) errors.push(`${count("DEF")} défenseurs (attendu 3 à 6)`);
  if (count("MID") < 3 || count("MID") > 6) errors.push(`${count("MID")} milieux (attendu 3 à 6)`);
  if (count("ATT") < 1 || count("ATT") > 4) errors.push(`${count("ATT")} attaquants (attendu 1 à 4)`);
  return errors;
}
