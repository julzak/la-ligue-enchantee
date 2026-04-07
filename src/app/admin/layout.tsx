"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Zap, Trophy, Gavel, Snowflake, CreditCard, Users, UserPlus, BookOpen, Settings, Shield, ArrowUpDown } from "lucide-react";

const mainLinks = [
  { href: "/admin/notes", label: "Notes", icon: ClipboardList },
  { href: "/admin/jokers", label: "Jokers", icon: Zap },
  { href: "/admin/equipes", label: "Équipes", icon: Users },
  { href: "/admin/coupe-france", label: "Coupe", icon: Trophy },
];

const utilLinks = [
  { href: "/admin/joueurs", label: "Joueurs", icon: UserPlus },
  { href: "/admin/promotions", label: "Mouvements", icon: ArrowUpDown },
  { href: "/admin/utilisateurs", label: "Admins", icon: Shield },
  { href: "/admin/config", label: "Configuration", icon: Settings },
  { href: "/admin/guide", label: "Guide admin", icon: BookOpen },
];

const foireLinks = [
  { href: "/admin/encheres", label: "Mercato d'été", icon: Gavel },
  { href: "/admin/mercato-hiver", label: "Mercato d'hiver", icon: Snowflake },
  { href: "/admin/paiements", label: "Paiements", icon: CreditCard },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
    const isActive = pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
          isActive
            ? "bg-gold/10 text-gold"
            : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-surface border-r border-white/[0.07] p-4 shrink-0">
        <Link href="/" className="flex items-center gap-1 text-xs text-muted hover:text-white/70 transition-colors px-2 mb-3">
          &larr; Retour au site
        </Link>
        <h2 className="font-serif text-gold text-sm mb-6 px-2">Administration</h2>
        <nav className="space-y-1">
          {mainLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        <div className="mt-6 pt-4 border-t border-white/[0.05]">
          <p className="text-[10px] uppercase tracking-wider text-muted px-3 mb-2">Foire à la saucisse</p>
          <nav className="space-y-1">
            {foireLinks.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </nav>
        </div>

        <div className="mt-6 pt-4 border-t border-white/[0.05]">
          <nav className="space-y-1">
            {utilLinks.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
