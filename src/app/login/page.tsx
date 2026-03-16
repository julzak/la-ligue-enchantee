"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      login,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Identifiant ou mot de passe incorrect");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg width="180" height="206" viewBox="0 0 130 148" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="sp-d" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                  <rect width="5" height="10" fill="#C8A84B"/>
                </pattern>
              </defs>
              <path d="M10,8 L120,8 L120,108 Q65,145 10,108 Z" fill="#1C1C1C"/>
              <path d="M10,8 L120,8 L120,108 Q65,145 10,108 Z" fill="url(#sp-d)" opacity="0.055"/>
              <path d="M10,8 L120,8 L120,108 Q65,145 10,108 Z" fill="none" stroke="#C8A84B" strokeWidth="2"/>
              <path d="M17,15 L113,15 L113,105 Q65,137 17,105 Z" fill="none" stroke="#C8A84B" strokeWidth="0.5" opacity="0.3"/>
              <line x1="10" y1="66" x2="120" y2="66" stroke="#C8A84B" strokeWidth="0.7" opacity="0.35"/>
              <polygon points="35,26 36.8,32 43,32 38,35.5 40,41.5 35,38 30,41.5 32,35.5 27,32 33.2,32" fill="#C8A84B"/>
              <polygon points="65,20 67.2,27 74,27 68.5,31 70.8,38 65,34 59.2,38 61.5,31 56,27 62.8,27" fill="#C8A84B"/>
              <polygon points="95,26 96.8,32 103,32 98,35.5 100,41.5 95,38 90,41.5 92,35.5 87,32 93.2,32" fill="#C8A84B"/>
              <text x="65" y="56" fontFamily="Arial Black,Impact,sans-serif" fontSize="12" fontWeight="900" fill="rgba(255,255,255,.3)" textAnchor="middle" dominantBaseline="central" letterSpacing="5">LA</text>
              <text x="65" y="78" fontFamily="Arial Black,Impact,sans-serif" fontSize="23" fontWeight="900" fill="#FFFFFF" textAnchor="middle" dominantBaseline="central" letterSpacing="-0.5">LIGUE</text>
              <text x="65" y="100" fontFamily="Georgia,serif" fontSize="11" fontWeight="400" fontStyle="italic" fill="#C8A84B" textAnchor="middle" dominantBaseline="central" letterSpacing="2.5">Enchantée</text>
            </svg>
          </div>
          <p className="text-sm text-muted">Connectez-vous pour accéder à votre ligue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-lg border border-white/[0.07] p-6 space-y-4">
          {error && (
            <div className="bg-rouge/10 border border-rouge/20 rounded px-3 py-2 text-sm text-rouge text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">Identifiant</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full h-10 bg-surface-2 border border-white/[0.07] rounded px-3 text-sm text-white placeholder:text-muted focus:outline-none focus:border-gold"
              placeholder="Votre pseudo"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 bg-surface-2 border border-white/[0.07] rounded px-3 text-sm text-white placeholder:text-muted focus:outline-none focus:border-gold"
              placeholder="Votre mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !login || !password}
            className="w-full h-10 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

      </div>
    </div>
  );
}
