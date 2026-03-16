"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

interface PaywallGateProps {
  children: React.ReactNode;
}

export function PaywallGate({ children }: PaywallGateProps) {
  const [simulateUnpaid, setSimulateUnpaid] = useState(false);

  return (
    <>
      {/* Dev toggle */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-surface-2 border-b border-white/[0.07] px-4 py-1.5 flex items-center justify-center gap-3 text-xs text-muted">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={simulateUnpaid}
            onChange={(e) => setSimulateUnpaid(e.target.checked)}
            className="accent-gold"
          />
          Simuler paiement non effectué
        </label>
      </div>

      {simulateUnpaid ? (
        <div className="min-h-screen flex items-center justify-center pt-10">
          <div className="bg-surface rounded-lg border border-white/[0.07] p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-gold" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Cotisation 2024-2025 non réglée
            </h2>
            <p className="text-muted text-sm mb-8">
              L&apos;accès est débloqué instantanément après paiement (30 euros).
            </p>
            <button className="w-full h-11 bg-gold text-night font-semibold rounded hover:bg-gold/90 transition-colors">
              Regler ma cotisation
            </button>
            <p className="text-xs text-muted mt-4">Paiement sécurisé via Stripe</p>
          </div>
        </div>
      ) : (
        <div className="pt-8">{children}</div>
      )}
    </>
  );
}
