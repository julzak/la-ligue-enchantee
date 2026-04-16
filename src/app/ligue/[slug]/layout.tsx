"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { LockCountdown } from "@/components/layout/LockCountdown";
import { Gavel, Snowflake } from "lucide-react";

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

  // Fetch current matchday + deadline from DB
  const [currentMatchday, setCurrentMatchday] = useState(28);
  const [lockAt, setLockAt] = useState<Date>(() => {
    // Default: next Thursday midnight
    const now = new Date();
    const d = (4 - now.getDay() + 7) % 7 || 7;
    const dt = new Date(now);
    dt.setDate(now.getDate() + d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  });

  // Check if there's an active auction for this league
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [auctionRound, setAuctionRound] = useState(0);
  const [auctionType, setAuctionType] = useState<string>("summer");
  useEffect(() => {
    fetch(`/api/auction?leagueId=0&checkOnly=1`)
      .catch(() => {});
    // Check by fetching the league's auction status
    async function checkState() {
      try {
        // Get current matchday + deadline
        const deadlineRes = await fetch("/api/admin/deadline");
        const deadlineData = await deadlineRes.json();
        if (deadlineData.day) setCurrentMatchday(deadlineData.day);
        if (deadlineData.lockAt) setLockAt(new Date(deadlineData.lockAt));
      } catch {}
      try {
        // Check auction
        const leaguesRes = await fetch("/api/admin/jokers/leagues");
        const leaguesData = await leaguesRes.json();
        const league = (leaguesData.leagues ?? []).find((l: { slug: string }) => l.slug === slug);
        if (!league) return;
        const res = await fetch(`/api/auction?leagueId=${league.dbId}`);
        const data = await res.json();
        if (data.auction?.isOpen) {
          setAuctionOpen(true);
          setAuctionRound(data.auction.currentRound);
          setAuctionType(data.auction.type ?? "summer");
        }
      } catch {}
    }
    checkState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const tabs = [
    { href: `/ligue/${slug}/classement`, label: "RÉSULTATS", live: true },
    { href: `/ligue/${slug}/classement-general`, label: "GÉNÉRAL" },
    { href: `/ligue/${slug}/statistiques`, label: "STATS" },
    { href: `/ligue/${slug}/explorateur`, label: "CLUBS" },
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
        <LockCountdown matchdayNumber={currentMatchday} lockAt={lockAt} isLocked={false} />

        {/* Auction banner — hidden on the auction page itself */}
        {auctionOpen && !pathname.includes("/encheres") && (
          <Link
            href={`/ligue/${slug}/encheres`}
            className={`block ${auctionType === "winter" ? "bg-blue-500/10 border-b border-blue-400/20" : "bg-gold/10 border-b border-gold/20"} py-2.5 text-center hover:opacity-80 transition-colors`}
          >
            <span className={`text-sm ${auctionType === "winter" ? "text-blue-400" : "text-gold"} font-medium flex items-center justify-center gap-2`}>
              {auctionType === "winter" ? <Snowflake className="w-4 h-4" /> : <Gavel className="w-4 h-4" />}
              {auctionType === "winter" ? "Mercato d'hiver" : "Mercato"} en cours - Tour {auctionRound} - Placez vos enchères !
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

            <div className="flex-1" />
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {children}
        </main>
      </div>
    </>
  );
}
