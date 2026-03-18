"use client";

import { useState, useEffect } from "react";
import { CreditCard, Loader2, Check } from "lucide-react";

interface Payment {
  userId: number;
  userName: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
}

export default function PaiementsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ totalPaid: 0, totalDue: 0, totalAmount: 0, collectedAmount: 0 });
  const [loading, setLoading] = useState(true);

  async function fetchPayments() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/paiements");
      const data = await res.json();
      setPayments(data.payments ?? []);
      setStats({ totalPaid: data.totalPaid, totalDue: data.totalDue, totalAmount: data.totalAmount, collectedAmount: data.collectedAmount });
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchPayments(); }, []);

  async function togglePaid(userId: number, paid: boolean) {
    await fetch("/api/admin/paiements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, paid }),
    });
    fetchPayments();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-gold" />
          Paiements
        </h1>
        <p className="text-sm text-muted">Cotisation 30€ — Saison 2025-2026</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
          <span className="text-2xl font-serif font-bold text-gold">{stats.totalPaid}/{stats.totalDue}</span>
          <p className="text-xs text-muted mt-1">Payés</p>
        </div>
        <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
          <span className="text-2xl font-serif font-bold text-vert">{stats.collectedAmount}€</span>
          <p className="text-xs text-muted mt-1">Collectés</p>
        </div>
        <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center">
          <span className="text-2xl font-serif font-bold text-white/50">{stats.totalAmount - stats.collectedAmount}€</span>
          <p className="text-xs text-muted mt-1">Restant</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : (
        <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
          {payments.map((p) => (
            <div
              key={p.userId}
              className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 ${p.paid ? "bg-vert/[0.03]" : ""}`}
            >
              <button
                onClick={() => togglePaid(p.userId, !p.paid)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                  p.paid
                    ? "border-vert bg-vert/20 text-vert"
                    : "border-white/20 hover:border-gold text-transparent hover:text-gold"
                }`}
              >
                <Check className="w-4 h-4" />
              </button>
              <span className={`text-sm flex-1 ${p.paid ? "text-white" : "text-white/60"}`}>
                {p.userName}
              </span>
              <span className="text-sm text-gold tabular-nums">{p.amount}€</span>
              {p.paid && p.paidAt && (
                <span className="text-[10px] text-muted">
                  {new Date(p.paidAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
