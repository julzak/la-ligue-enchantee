/**
 * Génère le récap texte brut d'un tour dépouillé pour un participant.
 * Fonction pure (pas d'accès DB) : utilisable en vitest et dans l'API.
 *
 * Format attendu (BRIEF-06 — règle 3.2.d amendée 2026-06-11) :
 *   email MANUEL par les modérateurs à partir de ce texte brut.
 */

export interface RecapAcquisition {
  playerName: string;
  position: string;
  clubName: string;
  amount: number;
}

export interface RecapLoss {
  playerName: string;
  position?: string;
  /** 'surenchere' | 'tie' | 'lost' */
  reasonType: "surenchere" | "tie" | "lost";
  yourBid: number;
  /** ex: "obtenu par Dupont à 18 pts" ou "entre Troyan et GeLo 59 à 20 pts, personne ne l'obtient, remis en jeu au tour suivant" */
  detail: string;
  refund?: number;
}

export interface RecapRemoval {
  playerName: string;
  amount: number;
  reason: string;
}

export interface ParticipantRoundRecap {
  userName: string;
  round: number;
  acquisitions: RecapAcquisition[];
  losses: RecapLoss[];
  removals: RecapRemoval[];
  budgetRemaining: number;
  playersWon: number;
  playersPerUser: number;
}

/**
 * Formate le détail d'une égalité de mise avec les pseudos des participants à égalité.
 * Utilisé pour les DEUX cas : les participants à égalité (status 'tie') ET ceux qui
 * ont misé moins sur le même joueur (status 'lost' sans gagnant), afin qu'il soit
 * clair pour tous que le joueur n'est attribué à personne.
 * Rendu : "entre Troyan et GeLo 59 à 20 pts, personne ne l'obtient, remis en jeu au tour suivant"
 */
export function formatTieDetail(names: string[], amount: number): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b, "fr"));
  const list =
    sorted.length > 1
      ? `${sorted.slice(0, -1).join(", ")} et ${sorted[sorted.length - 1]}`
      : sorted[0] ?? "";
  return `entre ${list} à ${amount} pts, personne ne l'obtient, remis en jeu au tour suivant`;
}

/**
 * Formate le récap d'un participant en texte brut prêt à coller dans un email.
 */
export function formatParticipantRecap(data: ParticipantRoundRecap): string {
  const lines: string[] = [];

  lines.push(`=== Résultats Tour ${data.round} — ${data.userName} ===`);
  lines.push("");

  if (data.acquisitions.length > 0) {
    lines.push("ACQUISITIONS :");
    for (const a of data.acquisitions) {
      lines.push(`  + ${a.playerName} (${a.position}, ${a.clubName}) — ${a.amount} pts`);
    }
  } else {
    lines.push("ACQUISITIONS : aucune ce tour.");
  }

  lines.push("");

  if (data.losses.length > 0) {
    lines.push("MISES PERDUES :");
    for (const l of data.losses) {
      const prefix = l.reasonType === "tie" ? "Égalité" : "Surenchéri";
      lines.push(`  - ${l.playerName} (misé ${l.yourBid} pts) — ${prefix} : ${l.detail}`);
    }
  }

  if (data.removals.length > 0) {
    if (data.losses.length > 0) lines.push("");
    lines.push("RETRAITS DE PÉNALITÉ :");
    for (const r of data.removals) {
      lines.push(`  ! ${r.playerName} (${r.amount} pts) retiré — ${r.reason}`);
    }
  }

  if (data.losses.length === 0 && data.removals.length === 0 && data.acquisitions.length > 0) {
    lines.push("Aucune mise perdue ni retrait ce tour.");
  }

  lines.push("");
  lines.push(`BUDGET RESTANT : ${data.budgetRemaining} pts`);
  lines.push(`EFFECTIF : ${data.playersWon} / ${data.playersPerUser} joueurs`);

  return lines.join("\n");
}

/**
 * Concatène les récaps de tous les participants en un seul bloc copiable.
 */
export function formatAllRecaps(recaps: ParticipantRoundRecap[]): string {
  return recaps.map(formatParticipantRecap).join("\n\n---\n\n");
}
