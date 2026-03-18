"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { LockCountdown } from "@/components/layout/LockCountdown";
import { Search, Gavel } from "lucide-react";

const leagueNames: Record<string, string> = {
  "ligue-1": "Ligue 1 (Baudens League)",
  "ligue-2": "Ligue 2",
  "national-1": "National 1",
};

export default function LigueLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;
  const leagueName = leagueNames[slug] ?? slug;

  // Mock: next lock is tomorrow 13h
  const lockAt = new Date();
  lockAt.setDate(lockAt.getDate() + 1);
  lockAt.setHours(13, 0, 0, 0);

  // Check if there's an active auction for this league
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [auctionRound, setAuctionRound] = useState(0);
  useEffect(() => {
    fetch(`/api/auction?leagueId=0&checkOnly=1`)
      .catch(() => {});
    // Check by fetching the league's auction status
    async function checkAuction() {
      try {
        const leaguesRes = await fetch("/api/admin/jokers/leagues");
        const leaguesData = await leaguesRes.json();
        const league = (leaguesData.leagues ?? []).find((l: { slug: string }) => l.slug === slug);
        if (!league) return;
        const res = await fetch(`/api/auction?leagueId=${league.dbId}`);
        const data = await res.json();
        if (data.auction?.isOpen) {
          setAuctionOpen(true);
          setAuctionRound(data.auction.currentRound);
        }
      } catch {}
    }
    checkAuction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const tabs = [
    { href: `/ligue/${slug}/classement`, label: "RÉSULTATS", live: true },
    { href: `/ligue/${slug}/classement-general`, label: "GÉNÉRAL" },
    { href: `/ligue/${slug}/statistiques`, label: "STATS" },
  ];

  function isTabActive(tabHref: string) {
    // "Résultats" tab is active for classement + resultats pages
    if (tabHref.endsWith("/classement")) {
      return pathname.endsWith("/classement") || pathname.includes("/resultats");
    }
    return pathname.startsWith(tabHref);
  }

  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <LockCountdown matchdayNumber={26} lockAt={lockAt} isLocked={false} />

        {/* Auction banner */}
        {auctionOpen && (
          <Link
            href={`/ligue/${slug}/encheres`}
            className="block bg-gold/10 border-b border-gold/20 py-2.5 text-center hover:bg-gold/15 transition-colors"
          >
            <span className="text-sm text-gold font-medium flex items-center justify-center gap-2">
              <Gavel className="w-4 h-4" />
              Mercato en cours - Tour {auctionRound} - Placez vos enchères !
            </span>
          </Link>
        )}

        {/* League header + sub-nav */}
        <div className="bg-night border-b border-gold/20">
          {/* League name */}
          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-3 pb-0">
            <h1 className="font-serif text-base text-gold text-center sm:text-left">{leagueName}</h1>
          </div>

          {/* Tab bar */}
          <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-0 mt-2">
            {tabs.map((tab) => {
              const active = isTabActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative px-4 py-2.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-colors ${
                    active
                      ? "text-gold"
                      : "text-white/35 hover:text-white/60"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {tab.label}
                    {tab.live && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rouge animate-pulse" title="En cours" />
                    )}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gold rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* Explorateur - icon button on the right */}
            <div className="flex-1" />
            <Link
              href={`/ligue/${slug}/explorateur`}
              className={`p-2 rounded transition-colors ${
                pathname.includes("/explorateur")
                  ? "text-gold bg-gold/10"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
              }`}
              title="Explorateur - Clubs & joueurs libres"
            >
              <Search className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {children}
        </main>
      </div>
    </>
  );
}
