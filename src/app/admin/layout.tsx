"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Zap, MessageSquare } from "lucide-react";

const adminLinks = [
  { href: "/admin/notes", label: "Notes", icon: ClipboardList },
  { href: "/admin/jokers", label: "Jokers", icon: Zap },
  { href: "/admin/reclamations", label: "Reclamations", icon: MessageSquare },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-surface border-r border-white/[0.07] p-4 shrink-0">
        <h2 className="font-serif text-gold text-sm mb-6 px-2">Administration</h2>
        <nav className="space-y-1">
          {adminLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? "bg-gold/10 text-gold"
                    : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
                }`}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
