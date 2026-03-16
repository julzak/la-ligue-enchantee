"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { currentMatchday } from "@/lib/fixtures";
import { Logo } from "@/components/ui/Logo";

export function Navbar() {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string | undefined;

  const navLinks = slug
    ? [
        { href: `/ligue/${slug}/classement`, label: "Classement" },
        { href: `/ligue/${slug}/mon-equipe`, label: "Mon équipe" },
        { href: `/ligue/${slug}/coupe`, label: "Coupe" },
        { href: `/ligue/${slug}/forum`, label: "Forum" },
      ]
    : [];

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
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap transition-colors relative ${
                isActive
                  ? "text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
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
        <span className="text-xs font-medium bg-gold text-night px-2.5 py-1 rounded">
          J{currentMatchday}
        </span>
        <Link href="/" className="text-xs text-white/40 hover:text-white/60">
          Accueil
        </Link>
      </div>
    </nav>
  );
}
