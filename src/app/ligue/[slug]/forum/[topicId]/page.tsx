"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, Send, ArrowLeft, Pin, Lock } from "lucide-react";
import Link from "next/link";

interface Post {
  id: number;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
}

interface TopicInfo {
  id: number;
  title: string;
  authorName: string;
  postCount: number;
  pinned: boolean;
  locked: boolean;
  category: string;
  createdAt: string;
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function TopicPage() {
  const params = useParams();
  const slug = params.slug as string;
  const topicId = Number(params.topicId);

  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTopic = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forum/posts?topicId=${topicId}`);
      const data = await res.json();
      setTopic(data.topic);
      setPosts(data.posts ?? []);
    } catch {}
    setLoading(false);
  }, [topicId]);

  useEffect(() => { fetchTopic(); }, [fetchTopic]);

  async function handleReply() {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, content: reply }),
      });
      const data = await res.json();
      if (data.ok) {
        setReply("");
        fetchTopic();
      }
    } catch {}
    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>;
  }

  if (!topic) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Sujet introuvable</p>
        <Link href={`/ligue/${slug}/forum`} className="text-sm text-gold hover:underline mt-2 block">
          Retour au forum
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/ligue/${slug}/forum`} className="text-xs text-muted hover:text-gold transition-colors flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3 h-3" /> Retour au forum
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {topic.pinned && <Pin className="w-4 h-4 text-gold shrink-0" />}
          {topic.locked && <Lock className="w-4 h-4 text-muted shrink-0" />}
          <h1 className="font-serif text-xl text-white">{topic.title}</h1>
          {topic.category === "reclamation" && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold/15 text-gold">
              Reclamation
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-1">
          Par {topic.authorName} · {formatDate(topic.createdAt)} · {topic.postCount} message{topic.postCount > 1 ? "s" : ""}
        </p>
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts.map((post, i) => (
          <div key={post.id} className={`bg-surface rounded-lg border border-white/[0.07] p-4 ${i === 0 ? "border-l-2 border-l-gold" : ""}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${getAvatarColor(post.authorName)}`}>
                {getInitials(post.authorName)}
              </div>
              <span className="text-sm font-medium text-white">{post.authorName}</span>
              <span className="text-xs text-muted">{formatDate(post.createdAt)}</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{post.content}</p>
          </div>
        ))}
      </div>

      {/* Reply form */}
      {!topic.locked ? (
        <div className="bg-surface rounded-lg border border-white/[0.07] p-4">
          <textarea
            placeholder="Votre reponse..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={3}
            className="w-full bg-surface-2 border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted resize-none focus:outline-none focus:border-gold"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleReply}
              disabled={submitting || !reply.trim()}
              className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Repondre
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border border-white/[0.07] p-4 text-center text-sm text-muted">
          🔒 Ce sujet est verrouille
        </div>
      )}
    </div>
  );
}
