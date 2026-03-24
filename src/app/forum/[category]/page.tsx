"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Pin, Loader2, Plus, Send, X, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EmojiButton } from "@/components/ui/EmojiButton";

const CAT_LABELS: Record<string, string> = {
  general: "Infos Generales",
  "ligue-1": "Ligue 1 (Baudens League)",
  "ligue-2": "Ligue 2",
  "national-1": "National 1",
  coupe: "Coupe Enchantee",
  reclamation: "Reclamations",
};

interface Topic {
  id: number;
  category: string;
  authorName: string;
  title: string;
  pinned: boolean;
  locked: boolean;
  postCount: number;
  lastPostAt: string | null;
  lastPostBy: string | null;
  createdAt: string;
  preview: string;
}

function getInitials(name: string): string {
  return name.split(/[\s/]+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    "bg-blue-500/20 text-blue-400", "bg-emerald-500/20 text-emerald-400",
    "bg-purple-500/20 text-purple-400", "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400", "bg-cyan-500/20 text-cyan-400",
  ];
  return colors[hash % colors.length];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function CategoryPage() {
  const params = useParams();
  const category = params.category as string;
  const label = CAT_LABELS[category] ?? category;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forum/topics?category=${category}`);
      const data = await res.json();
      setTopics(data.topics ?? []);
    } catch {}
    setLoading(false);
  }, [category]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  async function handleNewTopic() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: 0, title: newTitle, content: newContent, category }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowNew(false);
        setNewTitle("");
        setNewContent("");
        fetchTopics();
      }
    } catch {}
    setSubmitting(false);
  }

  const pinned = topics.filter(t => t.pinned);
  const regular = topics.filter(t => !t.pinned);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <Link href="/forum" className="text-xs text-muted hover:text-gold transition-colors flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Retour au forum
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-white mb-1">{label}</h1>
          <p className="text-sm text-muted">{topics.length} sujets</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="h-9 px-4 bg-gold text-night font-medium rounded text-sm hover:bg-gold/90 transition-colors font-serif flex items-center gap-2"
        >
          {showNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showNew ? "Annuler" : "Nouveau sujet"}
        </button>
      </div>

      {/* New topic form */}
      {showNew && (
        <div className="bg-surface rounded-lg border border-gold/20 p-5 space-y-3 mb-6">
          <input
            type="text"
            placeholder="Titre du sujet"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="w-full bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-gold"
          />
          <textarea
            placeholder="Votre message..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={4}
            className="w-full bg-surface-2 border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted resize-none focus:outline-none focus:border-gold"
          />
          <div className="flex items-center justify-between">
            <EmojiButton onSelect={emoji => setNewContent(prev => prev + emoji)} />
            <button
              onClick={handleNewTopic}
              disabled={submitting || !newTitle.trim() || !newContent.trim()}
              className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publier
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {topics.length === 0 && !showNew && (
        <div className="bg-surface rounded-lg border border-white/[0.07] p-12 text-center">
          <p className="text-muted">Aucun sujet dans cette categorie</p>
        </div>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-2 mb-4">
          {pinned.map(topic => (
            <Link key={topic.id} href={`/forum/topic/${topic.id}`}
              className="block bg-surface rounded-lg border border-white/[0.07] border-l-2 border-l-gold overflow-hidden hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-4 px-4 py-4">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(topic.lastPostBy ?? topic.authorName)}`}>
                  {getInitials(topic.lastPostBy ?? topic.authorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Pin className="w-3.5 h-3.5 text-gold shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">{topic.title}</span>
                    {topic.postCount > 10 && <span className="shrink-0">🔥</span>}
                  </div>
                  <p className="text-xs text-muted/70 line-clamp-1 mb-1.5">{topic.preview}</p>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>Par {topic.authorName}</span>
                    <span className="text-white/20">·</span>
                    <span>{topic.postCount} msg</span>
                    {topic.lastPostAt && <><span className="text-white/20">·</span><span>{topic.lastPostBy}, {timeAgo(topic.lastPostAt)}</span></>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Regular */}
      {regular.length > 0 && (
        <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden divide-y divide-white/[0.07]">
          {regular.map(topic => (
            <Link key={topic.id} href={`/forum/topic/${topic.id}`}
              className="flex items-start gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(topic.lastPostBy ?? topic.authorName)}`}>
                {getInitials(topic.lastPostBy ?? topic.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{topic.title}</span>
                  {topic.postCount > 10 && <span className="shrink-0">🔥</span>}
                  {topic.locked && <span className="text-[10px] text-muted">🔒</span>}
                </div>
                <p className="text-xs text-muted/70 line-clamp-1 mb-1.5">{topic.preview}</p>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>Par {topic.authorName}</span>
                  <span className="text-white/20">·</span>
                  <span>{topic.postCount} msg</span>
                  {topic.lastPostAt && <><span className="text-white/20">·</span><span>{topic.lastPostBy}, {timeAgo(topic.lastPostAt)}</span></>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
