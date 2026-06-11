// Couche d'orchestration PURE du dépouillement (BRIEF-05) : fait le pont
// entre les lignes DB (AUCTION_BID, PLAYER, TEAM) et le moteur de règlement
// `src/lib/auction-engine.ts`, sans AUCUN calcul de règle ici : toute
// attribution, égalité, restitution ou retrait vient du moteur. Ce module se
// limite à la traduction (lignes DB → entrées moteur → plan d'écritures DB)
// et au libellé lisible des motifs.
//
// Zéro dépendance DB ou React : importable par la route admin ET par les
// tests vitest (le DATABASE_URL local pointe sur la prod, aucun test ne doit
// toucher une vraie base).

import {
  resolveRound,
  canCompleteWith,
  validateFinalRoster,
  type EnginePlayer,
  type ParticipantInput,
  type RoundOutcome,
  type Line,
} from "./auction-engine";

// ── Mapping position DB → ligne moteur ─────────────────────────────────────
// Même logique que mapPosition de db.ts (non importable hors RSC : react.cache).
export function lineFromPosition(dbPosition: string): Line {
  const lower = dbPosition.toLowerCase();
  if (lower.includes("gardien")) return "GK";
  if (lower.includes("fense") || lower.includes("défense")) return "DEF";
  if (lower.includes("milieu")) return "MID";
  if (lower.includes("attaq")) return "ATT";
  return "MID"; // fallback aligné sur db.ts
}

// ── Types d'entrée (projections des lignes DB) ─────────────────────────────
export interface ResolutionPlayer {
  id: number;
  lastName: string; // LNAME (ordre alphabétique des retraits, règle 3.2.c.2)
  position: string; // POSITION brute DB
  displayName?: string; // nom complet pour les motifs lisibles (défaut : lastName)
}

export interface PendingBidRow {
  id: number; // AUCTION_BID.id
  userId: number;
  playerId: number;
  amount: number;
}

export interface WonBidRow {
  userId: number;
  playerId: number;
  amount: number;
}

export interface ResolutionInput {
  budgetPerUser: number;
  participantIds: number[]; // tous les participants de la ligue
  players: Map<number, ResolutionPlayer>; // tous les joueurs référencés par les mises
  wonBids: WonBidRow[]; // statut 'won', tous tours confondus (acquis cumulés)
  pendingBids: PendingBidRow[]; // statut 'pending', tour courant
}

// ── Construction des entrées moteur ────────────────────────────────────────
function toEnginePlayer(
  players: Map<number, ResolutionPlayer>,
  playerId: number
): EnginePlayer {
  const p = players.get(playerId);
  if (!p) throw new Error(`Joueur #${playerId} introuvable dans les données du dépouillement`);
  return { id: p.id, lastName: p.lastName, line: lineFromPosition(p.position) };
}

export function buildEngineInput(input: ResolutionInput): ParticipantInput[] {
  const wonByUser = new Map<number, WonBidRow[]>();
  for (const w of input.wonBids) {
    const arr = wonByUser.get(w.userId) ?? [];
    arr.push(w);
    wonByUser.set(w.userId, arr);
  }
  const pendingByUser = new Map<number, PendingBidRow[]>();
  for (const b of input.pendingBids) {
    const arr = pendingByUser.get(b.userId) ?? [];
    arr.push(b);
    pendingByUser.set(b.userId, arr);
  }

  return input.participantIds.map((userId) => {
    const won = wonByUser.get(userId) ?? [];
    const spent = won.reduce((s, w) => s + w.amount, 0);

    // B3 : Défense double-won — toute mise pending portant sur un joueur déjà
    // acquis (statut 'won') par ce même participant est rejetée immédiatement
    // avec une erreur 409. Cela couvre le cas où un admin aurait inséré
    // manuellement une mise en doublon ou soumis deux fois le dépouillement.
    const wonPlayerIds = new Set(won.map((w) => w.playerId));
    const pendingBids = pendingByUser.get(userId) ?? [];
    for (const b of pendingBids) {
      if (wonPlayerIds.has(b.playerId)) {
        const player = input.players.get(b.playerId);
        const name = player?.displayName ?? player?.lastName ?? `#${b.playerId}`;
        throw new Error(
          `Double-won détecté : le participant ${userId} a déjà remporté ${name} (joueur #${b.playerId}, mise #${b.id}). Dépouillement refusé.`
        );
      }
    }

    return {
      userId,
      budget: input.budgetPerUser - spent, // règle 3.2.b : seuls les acquis décomptent
      owned: won.map((w) => toEnginePlayer(input.players, w.playerId)),
      bids: pendingBids.map((b) => ({
        player: toEnginePlayer(input.players, b.playerId),
        amount: b.amount,
      })),
    };
  });
}

// ── Motifs lisibles des retraits (règle 3.2.c, affichés BRIEF-05/06) ───────
// Le moteur rend un motif canonique (ex: « Attaquants en excès dans la mise ») ;
// on le complète en phrase lisible avec le joueur retiré et le contexte chiffré
// de la mise. Description uniquement : aucun calcul de règle.
const LINE_LABELS: Record<Line, { singular: string; plural: string; max: number }> = {
  GK: { singular: "gardien", plural: "gardiens", max: 1 },
  DEF: { singular: "défenseur", plural: "défenseurs", max: 6 },
  MID: { singular: "milieu", plural: "milieux", max: 6 },
  ATT: { singular: "attaquant", plural: "attaquants", max: 4 },
};

export function formatRemovalReason(params: {
  engineReason: string;
  playerName: string;
  participant: ParticipantInput;
}): string {
  const { engineReason, playerName, participant } = params;
  const submitted = [...participant.owned, ...participant.bids.map((b) => b.player)];
  const countLine = (line: Line) => submitted.filter((p) => p.line === line).length;
  const totalBid = participant.bids.reduce((s, b) => s + b.amount, 0);

  if (engineReason === "Absence de gardien dans la mise") {
    return `Aucun gardien misé : retrait de ${playerName}, acquisition la plus chère du tour`;
  }
  for (const line of ["DEF", "MID", "ATT"] as Line[]) {
    const label = LINE_LABELS[line];
    const expected = `${label.plural.charAt(0).toUpperCase() + label.plural.slice(1)} en excès dans la mise`;
    if (engineReason === expected) {
      return `${countLine(line)} ${label.plural} misés (max ${label.max}) : retrait de ${playerName}, acquisition la plus chère de la ligne`;
    }
  }
  if (engineReason === "Moins de 13 joueurs misés") {
    return `${submitted.length} joueurs misés au lieu de 13 : retrait de ${playerName}, acquisition la plus chère du tour`;
  }
  if (engineReason === "Plus de 13 joueurs misés") {
    return `${submitted.length} joueurs misés au lieu de 13 : retrait de ${playerName}, acquisition la plus chère du tour`;
  }
  if (engineReason === "Total des mises supérieur au budget disponible") {
    return `Total des mises (${totalBid} pts) supérieur au budget disponible (${participant.budget} pts) : retrait de ${playerName}, acquisition la plus chère du tour`;
  }
  // Filet de sécurité : motif moteur inconnu, on le restitue tel quel.
  return `${engineReason} : retrait de ${playerName}`;
}

// ── Plan d'écritures DB d'un dépouillement ─────────────────────────────────
export type BidStatus = "won" | "lost" | "tie" | "removed";

export interface ResolutionPlan {
  outcome: RoundOutcome; // sortie brute du moteur (budgets, égalités, notes)
  updates: { bidId: number; status: BidStatus }[]; // 1 update par mise pending
  removals: {
    bidId: number;
    userId: number;
    playerId: number;
    amount: number;
    reason: string; // motif lisible persisté dans AUCTION_REMOVAL
  }[];
}

// Traduit la sortie du moteur en plan d'updates AUCTION_BID + insertions
// AUCTION_REMOVAL. Garantie : chaque mise pending reçoit exactement un statut
// (sinon erreur, on ne dépouille pas sur un état incohérent).
export function planResolution(input: ResolutionInput): ResolutionPlan {
  const participants = buildEngineInput(input);
  const outcome = resolveRound(participants);
  const participantById = new Map(participants.map((p) => [p.userId, p]));

  // Index des mises pending par (userId, playerId). L'unicité est garantie par
  // le chemin de soumission (remplacement par tour) ; on la vérifie quand même.
  const bidByKey = new Map<string, PendingBidRow>();
  for (const b of input.pendingBids) {
    const key = `${b.userId}|${b.playerId}`;
    if (bidByKey.has(key)) {
      throw new Error(`Mise en double pour participant ${b.userId}, joueur ${b.playerId}`);
    }
    bidByKey.set(key, b);
  }

  const statusByBidId = new Map<number, BidStatus>();
  const assign = (userId: number, playerId: number, status: BidStatus) => {
    const bid = bidByKey.get(`${userId}|${playerId}`);
    if (!bid) {
      throw new Error(`Sortie moteur sans mise correspondante (participant ${userId}, joueur ${playerId})`);
    }
    if (statusByBidId.has(bid.id)) {
      throw new Error(`Double statut pour la mise #${bid.id}`);
    }
    statusByBidId.set(bid.id, status);
    return bid;
  };

  for (const acq of outcome.acquisitions) assign(acq.userId, acq.player.id, "won");
  for (const lost of outcome.lostBids) assign(lost.userId, lost.playerId, "lost");
  for (const tie of outcome.ties) {
    for (const userId of tie.userIds) assign(userId, tie.playerId, "tie");
  }

  const removals: ResolutionPlan["removals"] = [];
  for (const removal of outcome.removals) {
    const bid = assign(removal.userId, removal.player.id, "removed");
    const participant = participantById.get(removal.userId);
    if (!participant) throw new Error(`Participant ${removal.userId} introuvable`);
    const playerRow = input.players.get(removal.player.id);
    const playerName = playerRow?.displayName ?? playerRow?.lastName ?? `#${removal.player.id}`;
    removals.push({
      bidId: bid.id,
      userId: removal.userId,
      playerId: removal.player.id,
      amount: removal.amount,
      reason: formatRemovalReason({ engineReason: removal.reason, playerName, participant }),
    });
  }

  // Complétude : toute mise pending doit avoir reçu exactement un statut.
  if (statusByBidId.size !== input.pendingBids.length) {
    const missing = input.pendingBids.filter((b) => !statusByBidId.has(b.id));
    throw new Error(
      `Dépouillement incomplet : ${missing.length} mise(s) sans statut (ids ${missing.map((b) => b.id).join(", ")})`
    );
  }

  return {
    outcome,
    updates: Array.from(statusByBidId.entries()).map(([bidId, status]) => ({ bidId, status })),
    removals,
  };
}

// ── Fin de phase : effectifs incomplets et complétion d'office (règle 4) ───
export interface RosterStatus {
  userId: number;
  roster: EnginePlayer[]; // acquis cumulés (mises won, complétions incluses)
  errors: string[]; // validateFinalRoster (vide = effectif valide)
  missingCount: number; // max(0, 13 - effectif)
  missingLines: string; // description lisible des minima manquants ("1 MIL, 1 ATT")
}

export function computeRosterStatuses(input: {
  participantIds: number[];
  players: Map<number, ResolutionPlayer>;
  wonBids: WonBidRow[];
}): RosterStatus[] {
  const wonByUser = new Map<number, WonBidRow[]>();
  for (const w of input.wonBids) {
    const arr = wonByUser.get(w.userId) ?? [];
    arr.push(w);
    wonByUser.set(w.userId, arr);
  }
  return input.participantIds.map((userId) => {
    const roster = (wonByUser.get(userId) ?? []).map((w) =>
      toEnginePlayer(input.players, w.playerId)
    );
    const errors = validateFinalRoster(roster);
    const count = (line: Line) => roster.filter((p) => p.line === line).length;
    const minima: { line: Line; min: number }[] = [
      { line: "GK", min: 1 },
      { line: "DEF", min: 3 },
      { line: "MID", min: 3 },
      { line: "ATT", min: 1 },
    ];
    const missingParts = minima
      .filter((m) => count(m.line) < m.min)
      .map((m) => `${m.min - count(m.line)} ${m.line === "GK" ? "G" : m.line === "DEF" ? "DEF" : m.line === "MID" ? "MIL" : "ATT"}`);
    return {
      userId,
      roster,
      errors,
      missingCount: Math.max(0, 13 - roster.length),
      missingLines: missingParts.join(", "),
    };
  });
}

// Propose des joueurs disponibles pour compléter d'office un effectif à 1 pt.
// La validité de chaque ajout vient du moteur (canCompleteWith) ; la sélection
// (quels joueurs proposer parmi les disponibles) est un choix d'admin, pas une
// règle : on comble d'abord les minima par ligne, puis le reste, par ordre
// alphabétique (déterminisme).
export function proposeCompletions(
  roster: EnginePlayer[],
  available: EnginePlayer[]
): EnginePlayer[] {
  const working = [...roster];
  const pool = [...available].sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"));
  const proposed: EnginePlayer[] = [];
  const count = (line: Line) => working.filter((p) => p.line === line).length;

  const take = (predicate: (p: EnginePlayer) => boolean): boolean => {
    const idx = pool.findIndex((p) => predicate(p) && canCompleteWith(working, p).ok);
    if (idx === -1) return false;
    const picked = pool.splice(idx, 1)[0];
    working.push(picked);
    proposed.push(picked);
    return true;
  };

  // 1) Minima par ligne (1 GK, 3 DEF, 3 MIL, 1 ATT) tant qu'il manque des places.
  const minima: { line: Line; min: number }[] = [
    { line: "GK", min: 1 },
    { line: "DEF", min: 3 },
    { line: "MID", min: 3 },
    { line: "ATT", min: 1 },
  ];
  for (const m of minima) {
    while (working.length < 13 && count(m.line) < m.min) {
      if (!take((p) => p.line === m.line)) break;
    }
  }
  // 2) Compléter à 13 avec n'importe quelle ligne acceptée par le moteur.
  while (working.length < 13) {
    if (!take(() => true)) break;
  }
  return proposed;
}

// ── Pont TEAM (fin de phase) ───────────────────────────────────────────────
// Lignes TEAM à insérer pour la saison : même forme que le chemin d'écriture
// des jokers (INSERT INTO TEAM ... DAY_LAST=38), avec DAY_FIRST=1 (effectif
// initial) et IS_SUBS=0 (les titulaires de journée vivent dans TEAM_DAY).
export interface TeamRow {
  leagueId: number;
  userId: number;
  playerId: number;
  dayFirst: number;
  dayLast: number;
  isSubs: number;
}

export function planTeamRows(
  leagueId: number,
  rosters: { userId: number; roster: EnginePlayer[] }[]
): TeamRow[] {
  const rows: TeamRow[] = [];
  for (const r of rosters) {
    const errors = validateFinalRoster(r.roster);
    if (errors.length > 0) {
      throw new Error(
        `Effectif invalide pour le participant ${r.userId} : ${errors.join(" ; ")}`
      );
    }
    for (const p of r.roster) {
      rows.push({
        leagueId,
        userId: r.userId,
        playerId: p.id,
        dayFirst: 1,
        dayLast: 38,
        isSubs: 0,
      });
    }
  }
  return rows;
}
