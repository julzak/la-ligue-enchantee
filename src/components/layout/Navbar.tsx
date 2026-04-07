"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/ui/Logo";
import { LogOut, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Navbar() {
  const pathname = usePathname();
  const params = useParams();
  const { data: session } = useSession();
  const slug = params.slug as string | undefined;

  // Keep league nav on /forum and other non-league pages
  const [savedSlug, setSavedSlug] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (slug) {
      localStorage.setItem("lastLeagueSlug", slug);
      setSavedSlug(slug);
    } else {
      const stored = localStorage.getItem("lastLeagueSlug");
      if (stored) setSavedSlug(stored);
    }
  }, [slug]);

  const effectiveSlug = slug ?? savedSlug;

  const navLinks = effectiveSlug
    ? [
        { href: `/ligue/${effectiveSlug}/classement`, label: "Classement" },
        { href: `/ligue/${effectiveSlug}/mon-equipe`, label: "Mon équipe" },
        { href: `/ligue/${effectiveSlug}/jokers`, label: "Jokers" },
        { href: "/forum", label: "Forum" },
      ]
    : [];

  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!session?.user) { setIsAdmin(false); return; }
    fetch("/api/is-admin")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [session]);

  const initials = session?.user?.name
    ? session.user.name
        .split(/[\s/]+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-[52px] bg-surface border-b border-white/[0.07] flex items-center px-4 md:px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <Logo size={28} />
        <span className="text-gold font-serif text-sm hidden sm:block">
          La Ligue Enchantée
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex-1 flex items-center justify-center gap-0.5 sm:gap-1 overflow-x-auto">
        {navLinks.map((link) => {
          const isExternal = "external" in link;
          const isActive = !isExternal && pathname.startsWith(link.href);
          const cls = `px-2 sm:px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap transition-colors relative ${
            isActive ? "text-white" : "text-white/40 hover:text-white/60"
          }`;
          if (isExternal) {
            return (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {link.label}
              </a>
            );
          }
          return (
            <Link key={link.href} href={link.href} className={cls}>
              {link.label}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold rounded-full" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />
        <Link href="/" className="text-xs text-white/40 hover:text-white/60 hidden sm:block">
          Accueil
        </Link>
        <Link href="/guide" className="text-xs text-white/40 hover:text-white/60 hidden md:block">
          Guide
        </Link>

        {session?.user ? (
          <div className="flex items-center gap-2">
            <Link href="/mon-compte" className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-[10px] font-semibold text-gold hover:bg-gold/25 transition-colors" title="Mon compte">
              {initials}
            </Link>
            <Link href="/mon-compte" className="text-xs text-white/60 hover:text-white transition-colors hidden sm:block">{session.user.name}</Link>
            {isAdmin && (
              <Link
                href="/admin/notes"
                className="p-1.5 text-white/30 hover:text-gold transition-colors"
                title="Administration"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-xs font-medium bg-gold text-night px-2.5 py-1 rounded hover:bg-gold/90 transition-colors"
          >
            Connexion
          </Link>
        )}
      </div>
    </nav>
  );
}
