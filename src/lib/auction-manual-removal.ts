// Retrait manuel d'une acquisition par un admin (bouton « Retirer » de la
// Console des enchères). Couche PURE : les gardes et le plan d'écriture sont
// calculés ici, la route ne fait que charger la mise et exécuter le plan.
//
// Modèle du geste (exactement ce qui a été fait en SQL pour le bid 2667) :
//   INSERT INTO AUCTION_REMOVAL ... SELECT ... FROM AUCTION_BID WHERE id=? AND status='won'
//   UPDATE AUCTION_BID SET status='removed' WHERE id=? AND status='won'
// Idempotent via la condition status='won' (double-clic sans effet).
//
// Effets automatiques (aucun autre write) : budget recrédité (calculé sur les
// won), joueur re-misable (takenIds = won).

export interface ManualRemovalBid {
  id: number;
  auctionId: number;
  round: number;
  userId: number;
  playerId: number;
  amount: number;
  status: string;
}

export interface ManualRemovalContext {
  /** Mise chargée par id, ou null si inexistante. */
  bid: ManualRemovalBid | null;
  /** Enchère de la ligue sélectionnée par l'admin. */
  auction: { id: number; status: string };
  /** Pseudo de l'admin de la session (traçabilité dans reason). */
  adminName: string;
}

export type ManualRemovalPlan =
  | { error: string; httpStatus: 404 | 409 }
  | {
      error?: never;
      removal: {
        auctionId: number;
        round: number;
        userId: number;
        playerId: number;
        amount: number;
        reason: string;
      };
    };

export function planManualRemoval(ctx: ManualRemovalContext): ManualRemovalPlan {
  const { bid, auction, adminName } = ctx;

  if (!bid) {
    return { error: "Mise introuvable", httpStatus: 404 };
  }
  if (bid.auctionId !== auction.id) {
    return {
      error: "Cette mise n'appartient pas à l'enchère de la ligue sélectionnée",
      httpStatus: 409,
    };
  }
  // Phase close : les effectifs sont déjà écrits dans TEAM, un retrait ici les
  // désynchroniserait. À traiter en SQL manuel si le cas se présente.
  if (auction.status === "resolved") {
    return {
      error: "La phase est close : les effectifs sont constitués, retrait impossible depuis la console",
      httpStatus: 409,
    };
  }
  if (bid.status !== "won") {
    return {
      error:
        bid.status === "removed"
          ? "Cette acquisition a déjà été retirée"
          : `Cette mise n'est pas une acquisition (statut '${bid.status}')`,
      httpStatus: 409,
    };
  }

  return {
    removal: {
      auctionId: bid.auctionId,
      round: bid.round,
      userId: bid.userId,
      playerId: bid.playerId,
      amount: bid.amount,
      // Traçabilité en attendant le vrai journal des actions admin (backlog).
      reason: `Retrait manuel par ${adminName.trim() || "admin"}`,
    },
  };
}
