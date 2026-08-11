/**
 * Récap mercato (écran /ligue/[slug]/mercato) — agrégation pure, sans DB.
 *
 * Ne manipule QUE des données publiques : les acquisitions (mises 'won')
 * des tours dépouillés. Les mises perdues, égalités et retraits restent
 * privés (règle de visibilité du dépouillement, cf. /api/auction/results).
 */

export interface MercatoWonBid {
  userId: number;
  round: number;
  playerId: number;
  playerName: string;
  position: string;
  clubName: string;
  amount: number;
}

export interface MercatoParticipantInput {
  userId: number;
  userName: string;
}

export interface MercatoAcquisition {
  round: number;
  playerId: number;
  playerName: string;
  position: string;
  clubName: string;
  amount: number;
}

export interface MercatoParticipant {
  userId: number;
  userName: string;
  totalSpent: number;
  playersWon: number;
  acquisitions: MercatoAcquisition[];
}

export interface MercatoRecap {
  /** Tours ayant au moins une acquisition, triés croissant. */
  rounds: number[];
  /** Tous les membres de la ligue, y compris sans acquisition, triés par nom. */
  participants: MercatoParticipant[];
  totals: { players: number; points: number };
}

/**
 * Regroupe les acquisitions par participant et calcule les totaux.
 * Un membre de la ligue sans aucune acquisition apparaît avec des listes vides
 * (il doit rester filtrable dans l'écran récap).
 */
export function buildMercatoRecap(
  participants: MercatoParticipantInput[],
  wonBids: MercatoWonBid[]
): MercatoRecap {
  const byUser = new Map<number, MercatoAcquisition[]>();
  const roundsSet = new Set<number>();

  for (const b of wonBids) {
    roundsSet.add(b.round);
    const arr = byUser.get(b.userId) ?? [];
    arr.push({
      round: b.round,
      playerId: b.playerId,
      playerName: b.playerName,
      position: b.position,
      clubName: b.clubName,
      amount: b.amount,
    });
    byUser.set(b.userId, arr);
  }

  const result: MercatoParticipant[] = participants
    .map((p) => {
      const acqs = (byUser.get(p.userId) ?? []).sort(
        (a, b) => a.round - b.round || b.amount - a.amount || a.playerName.localeCompare(b.playerName, "fr")
      );
      return {
        userId: p.userId,
        userName: p.userName,
        totalSpent: acqs.reduce((s, a) => s + a.amount, 0),
        playersWon: acqs.length,
        acquisitions: acqs,
      };
    })
    .sort((a, b) => a.userName.localeCompare(b.userName, "fr"));

  return {
    rounds: Array.from(roundsSet).sort((a, b) => a - b),
    participants: result,
    totals: {
      players: wonBids.length,
      points: wonBids.reduce((s, b) => s + b.amount, 0),
    },
  };
}
