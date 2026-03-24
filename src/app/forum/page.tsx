export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MessageSquare, ChevronRight } from "lucide-react";

const CATEGORIES = [
  { slug: "general", label: "Infos Generales", description: "Annonces, reglement, discussions generales" },
  { slug: "ligue-1", label: "Ligue 1 (Baudens League)", description: "Jokers, reclamations, resultats, chambrages" },
  { slug: "ligue-2", label: "Ligue 2", description: "Jokers, reclamations, resultats, chambrages" },
  { slug: "national-1", label: "National 1", description: "Jokers, reclamations, resultats, chambrages" },
  { slug: "coupe", label: "Coupe Enchantee", description: "Resultats, pronostics, petit poucet" },
];

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
  // Get topic counts and last activity per category
  const topics = await prisma.$queryRawUnsafe<{
    category: string; cnt: number; last_post_at: Date | null;
    last_title: string | null; last_poster: string | null;
  }[]>(`
    SELECT t.category, COUNT(*) as cnt, MAX(t.last_post_at) as last_post_at,
      (SELECT t2.title FROM FORUM_TOPIC t2 WHERE t2.category = t.category ORDER BY COALESCE(t2.last_post_at, t2.created_at) DESC LIMIT 1) as last_title,
      (SELECT u.NAME FROM FORUM_TOPIC t3 JOIN USER u ON t3.last_post_by = u.ID_USER WHERE t3.category = t.category ORDER BY COALESCE(t3.last_post_at, t3.created_at) DESC LIMIT 1) as last_poster
    FROM FORUM_TOPIC t
    GROUP BY t.category
  `);

  const catStats = new Map(topics.map(t => [
    t.category,
    {
      count: Number(t.cnt),
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
          <div className="mb-8">
            <h1 className="font-serif text-2xl text-gold mb-1">Forum</h1>
            <p className="text-sm text-muted">Discussions de La Ligue Enchantee</p>
          </div>

          {/* Recent activity */}
          {recentTopics.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-wider text-muted mb-3">Derniere activite</h2>
              <div className="bg-surface rounded-lg border border-white/[0.07] divide-y divide-white/[0.07]">
                {recentTopics.map(t => (
                  <Link
                    key={Number(t.id)}
                    href={`/forum/topic/${Number(t.id)}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-muted shrink-0" />
                    <span className="text-sm text-white flex-1 truncate">{t.title}</span>
                    <span className="text-[10px] text-muted shrink-0">{catLabels[t.category] ?? t.category}</span>
                    <span className="text-[10px] text-muted shrink-0">
                      {t.last_post_at ? timeAgo(t.last_post_at) : ""}
                    </span>
                    <span className="text-[10px] text-white/40 shrink-0">
                      {t.last_post_by ? posterMap.get(Number(t.last_post_by)) : ""}
                    </span>
                  </Link>
                ))}
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
                  className="block bg-surface rounded-lg border border-white/[0.07] hover:border-gold/20 transition-colors p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-serif text-white mb-1">{cat.label}</h3>
                      <p className="text-xs text-muted">{cat.description}</p>
                      {stats?.lastTitle && (
                        <p className="text-xs text-white/40 mt-2 truncate">
                          Dernier : {stats.lastTitle}
                          {stats.lastPoster && <span className="text-muted"> par {stats.lastPoster}</span>}
                          {stats.lastPostAt && <span className="text-muted"> · {timeAgo(stats.lastPostAt)}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <div className="text-center">
                        <span className="text-lg font-serif font-bold text-white">{stats?.count ?? 0}</span>
                        <p className="text-[9px] text-muted">sujets</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Archive link */}
          <div className="text-center mt-8">
            <a
              href="https://www.ligueenchantee.com/phpBB/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-gold transition-colors"
            >
              Archives du forum (ancien site) →
            </a>
          </div>
        </div>
  );
}
