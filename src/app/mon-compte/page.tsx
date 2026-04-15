"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/layout/Navbar";
import { User, Lock, Mail, Loader2, Check } from "lucide-react";

export default function MonComptePage() {
  const { data: session, status } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [emailLoaded, setEmailLoaded] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  // Load current email on mount
  if (session?.user?.email && !emailLoaded) {
    setEmail(session.user.email ?? "");
    setEmailLoaded(true);
  }

  async function handleChangeEmail() {
    setEmailMsg("");
    if (!email || !email.includes("@")) {
      setEmailMsg("Adresse email invalide");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setEmailMsg("Email mis a jour");
      } else {
        setEmailMsg(data.error ?? "Erreur");
      }
    } catch {
      setEmailMsg("Erreur reseau");
    }
    setSavingEmail(false);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-[52px] flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-[52px] max-w-md mx-auto px-4 py-12 text-center">
          <p className="text-muted">Connectez-vous pour accéder à votre compte.</p>
        </div>
      </div>
    );
  }

  async function handleChangePassword() {
    setMessage("");
    setSuccess(false);

    if (!currentPassword || !newPassword) {
      setMessage("Tous les champs sont requis");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 4) {
      setMessage("Le nouveau mot de passe doit faire au moins 4 caractères");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setMessage("Mot de passe modifié avec succès");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage(data.error ?? "Erreur");
      }
    } catch {
      setMessage("Erreur réseau");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-[52px]" />

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* User info */}
        <div className="bg-surface rounded-lg border border-white/[0.07] p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center">
              <User className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h1 className="font-serif text-xl text-white">{session.user.name}</h1>
              <p className="text-sm text-muted">{session.user.email}</p>
            </div>
          </div>
        </div>

        {/* Change email */}
        <div className="bg-surface rounded-lg border border-white/[0.07] p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-gold" />
            <h2 className="font-serif text-base text-white">Adresse email</h2>
          </div>
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
              placeholder="votre@email.com"
            />
          </div>
          {emailMsg && (
            <div className={`px-4 py-2 rounded text-sm ${emailMsg.includes("Erreur") || emailMsg.includes("invalide") ? "bg-rouge/10 text-rouge" : "bg-vert/10 text-vert"}`}>
              {emailMsg}
            </div>
          )}
          <button
            onClick={handleChangeEmail}
            disabled={savingEmail}
            className="w-full h-10 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Mettre a jour
          </button>
        </div>

        {/* Change password */}
        <div className="bg-surface rounded-lg border border-white/[0.07] p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-gold" />
            <h2 className="font-serif text-base text-white">Changer le mot de passe</h2>
          </div>

          <p className="text-xs text-muted">
            Le mot de passe par défaut est <strong className="text-white">ligue</strong>. Nous vous recommandons de le changer.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Mot de passe actuel</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                placeholder="Mot de passe actuel"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                placeholder="Nouveau mot de passe (min. 4 caractères)"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                placeholder="Confirmer"
              />
            </div>
          </div>

          {message && (
            <div className={`px-4 py-2 rounded text-sm ${success ? "bg-vert/10 text-vert" : "bg-rouge/10 text-rouge"}`}>
              {success && <Check className="w-4 h-4 inline mr-1" />}
              {message}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="w-full h-10 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Modifier le mot de passe
          </button>
        </div>
      </div>
    </div>
  );
}
