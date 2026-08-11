export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Megaphone, Trophy, ChevronRight } from "lucide-react";

const CATEGORIES = [
  {
    slug: "general",
    label: "Infos G\u00e9n\u00e9rales",
    description: "Annonces, r\u00e8glement, discussions g\u00e9n\u00e9rales",
    borderColor: "border-l-amber-400",
    badgeBg: "bg-amber-400/10 text-amber-400",
    icon: "megaphone" as const,
  },
  {
    slug: "ligue-1",
    label: "Ligue 1 (Baudens League)",
    description: "Jokers, r\u00e9clamations, r\u00e9sultats, chambrages",
    borderColor: "border-l-blue-400",
    // Pastille claire : les logos de ligue sont noirs sur fond transparent,
    // invisibles sur le thème sombre sans elle.
    badgeBg: "bg-white/90",
    icon: "ligue1" as const,
  },
  {
    slug: "ligue-2",
    label: "Ligue 2",
    description: "Jokers, r\u00e9clamations, r\u00e9sultats, chambrages",
    borderColor: "border-l-emerald-400",
    badgeBg: "bg-white/90",
    icon: "ligue2" as const,
  },
  {
    // Slug historique conserv\u00e9 : les topics existants sont rattach\u00e9s \u00e0
    // category='national-1' en DB. Seul l'affichage passe en Ligue 3.
    slug: "national-1",
    label: "Ligue 3",
    description: "Jokers, r\u00e9clamations, r\u00e9sultats, chambrages",
    borderColor: "border-l-purple-400",
    badgeBg: "bg-white/90",
    icon: "ligue3" as const,
  },
  {
    slug: "coupe",
    label: "Coupe Enchant\u00e9e",
    description: "R\u00e9sultats, pronostics, petit poucet",
    borderColor: "border-l-gold",
    badgeBg: "bg-gold/10 text-gold",
    icon: "coupe" as const,
  },
];

function CategoryIcon({ icon, className }: { icon: (typeof CATEGORIES)[number]["icon"]; className?: string }) {
  switch (icon) {
    case "megaphone":
      return <Megaphone className={className ?? "w-6 h-6"} />;
    case "ligue1":
      return <Image src="/leagues/ligue1.svg" alt="Ligue 1" width={28} height={28} className="shrink-0" />;
    case "ligue2":
      return <Image src="/leagues/ligue2.png" alt="Ligue 2" width={28} height={28} className="shrink-0" />;
    case "ligue3":
      return <Image src="/leagues/ligue3.svg" alt="Ligue 3" width={28} height={28} className="shrink-0" />;
    case "coupe":
      return <Trophy className={className ?? "w-6 h-6"} />;
  }
}

function getInitials(name: string): string {
  return name.split(/[\s/]+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    "bg-blue-500/20 text-blue-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-purple-500/20 text-purple-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-cyan-500/20 text-cyan-400",
  ];
  return colors[hash % colors.length];
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function ForumPage() {
  // Get topic counts, total post counts, and last activity per category
  const topics = await prisma.$queryRawUnsafe<{
    category: string; cnt: number; total_posts: number; last_post_at: Date | null;
    last_title: string | null; last_poster: string | null;
  }[]>(`
    SELECT t.category, COUNT(*) as cnt,
      COALESCE(SUM(t.post_count), 0) as total_posts,
      MAX(t.last_post_at) as last_post_at,
      (SELECT t2.title FROM FORUM_TOPIC t2 WHERE t2.category = t.category ORDER BY COALESCE(t2.last_post_at, t2.created_at) DESC LIMIT 1) as last_title,
      (SELECT u.NAME FROM FORUM_TOPIC t3 JOIN USER u ON t3.last_post_by = u.ID_USER WHERE t3.category = t.category ORDER BY COALESCE(t3.last_post_at, t3.created_at) DESC LIMIT 1) as last_poster
    FROM FORUM_TOPIC t
    GROUP BY t.category
  `);

  const catStats = new Map(topics.map(t => [
    t.category,
    {
      count: Number(t.cnt),
      totalPosts: Number(t.total_posts),
      lastPostAt: t.last_post_at,
      lastTitle: t.last_title,
      lastPoster: t.last_poster ? (t.last_poster as string).replace(/<[^>]*>/g, "").trim() : null,
    },
  ]));

  // Get 5 most recently active topics across all categories
  const recentTopics = await prisma.$queryRawUnsafe<{
    id: number; category: string; title: string; post_count: number;
    last_post_at: Date | null; last_post_by: number | null;
  }[]>(`
    SELECT t.id, t.category, t.title, t.post_count, t.last_post_at, t.last_post_by
    FROM FORUM_TOPIC t
    ORDER BY COALESCE(t.last_post_at, t.created_at) DESC
    LIMIT 5
  `);

  const posterIds = recentTopics.map(t => t.last_post_by).filter(Boolean) as number[];
  const posters = posterIds.length > 0
    ? await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
        `SELECT ID_USER, NAME FROM USER WHERE ID_USER IN (${posterIds.join(",")})`)
    : [];
  const posterMap = new Map(posters.map(u => [Number(u.ID_USER), (u.NAME ?? "").replace(/<[^>]*>/g, "").trim()]));

  const catLabels: Record<string, string> = {};
  CATEGORIES.forEach(c => { catLabels[c.slug] = c.label; });

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-10">
        <h1 className="font-serif text-3xl text-gold mb-2">Forum</h1>
        <p className="text-sm text-muted">
          20 ans de chambrages, r&eacute;clamations douteuses et mauvaise foi assum&eacute;e.
        </p>
      </div>

      {/* Recent activity */}
      {recentTopics.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-wider text-gold/70 font-semibold mb-3 flex items-center gap-2">
            <span className="text-base">&#128293;</span> Derni&egrave;re activit&eacute;
          </h2>
          <div className="bg-surface rounded-lg border border-white/[0.07] divide-y divide-white/[0.07]">
            {recentTopics.map(t => {
              const posterName = t.last_post_by ? posterMap.get(Number(t.last_post_by)) : null;
              return (
                <Link
                  key={Number(t.id)}
                  href={`/forum/topic/${Number(t.id)}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Avatar of last poster */}
                  {posterName ? (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(posterName)}`}>
                      {getInitials(posterName)}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/[0.05] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white group-hover:text-gold transition-colors truncate block">
                      {t.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted bg-white/[0.04] px-2 py-0.5 rounded-full shrink-0 hidden sm:inline">
                    {catLabels[t.category] ?? t.category}
                  </span>
                  <span className="text-[10px] text-muted shrink-0">
                    {t.last_post_at ? timeAgo(t.last_post_at) : ""}
                  </span>
                  {Number(t.post_count) > 10 && <span className="text-xs shrink-0">&#128293;</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const stats = catStats.get(cat.slug);
          return (
            <Link
              key={cat.slug}
              href={`/forum/${cat.slug}`}
              className={`block bg-surface rounded-lg border border-white/[0.07] border-l-[3px] ${cat.borderColor} hover:border-white/[0.12] hover:bg-white/[0.02] transition-all p-5 group`}
            >
              <div className="flex items-center gap-4">
                {/* Category icon */}
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${cat.badgeBg}`}>
                  <CategoryIcon icon={cat.icon} className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-serif text-white group-hover:text-gold transition-colors mb-0.5">
                    {cat.label}
                  </h3>
                  <p className="text-xs text-muted mb-0">{cat.description}</p>
                  {stats?.lastTitle && (
                    <p className="text-xs text-white/30 mt-2 truncate">
                      <span className="text-white/50">{stats.lastTitle}</span>
                      {stats.lastPoster && (
                        <span className="text-muted"> &mdash; {stats.lastPoster}</span>
                      )}
                      {stats.lastPostAt && (
                        <span className="text-muted"> &middot; {timeAgo(stats.lastPostAt)}</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 shrink-0 ml-2">
                  <div className="text-center hidden sm:block">
                    <span className="text-lg font-serif font-bold text-white block leading-tight">
                      {stats?.count ?? 0}
                    </span>
                    <p className="text-[9px] text-muted uppercase tracking-wide">sujets</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <span className="text-lg font-serif font-bold text-white/60 block leading-tight">
                      {stats?.totalPosts ?? 0}
                    </span>
                    <p className="text-[9px] text-muted uppercase tracking-wide">msgs</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted group-hover:text-gold transition-colors" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Archive link */}
      <div className="text-center mt-10">
        <a
          href="https://www.ligueenchantee.com/phpBB/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted hover:text-gold transition-colors inline-flex items-center gap-1"
        >
          Archives du forum (ancien site) &rarr;
        </a>
      </div>
    </div>
  );
}
