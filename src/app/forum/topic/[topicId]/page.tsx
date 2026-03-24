"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, Send, ArrowLeft, Pin, Lock } from "lucide-react";
import Link from "next/link";
import { EmojiButton } from "@/components/ui/EmojiButton";
import { useSession } from "next-auth/react";

interface Reaction {
  emoji: string;
  count: number;
  userIds: number[];
}

interface Post {
  id: number;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
  reactions: Reaction[];
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

const QUICK_REACTIONS = [
  { emoji: "👍", label: "+1" },
  { emoji: "😂", label: "lol" },
  { emoji: "🔥", label: "feu" },
  { emoji: "💀", label: "mort" },
  { emoji: "⚽", label: "foot" },
  { emoji: "🌭", label: "saucisse" },
  { emoji: "footix", label: "footix", isCustom: true },
];

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

function renderEmoji(emoji: string) {
  if (emoji === "footix") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/emoji/footix.jpg" alt="Footix" className="w-4 h-4 inline-block rounded-sm" />;
  }
  return <span>{emoji}</span>;
}

export default function TopicPage() {
  const params = useParams();
  const topicId = Number(params.topicId);
  const { data: session } = useSession();
  const myUserId = (session?.user as { userId?: number } | undefined)?.userId;

  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReactions, setShowReactions] = useState<number | null>(null);

  // Close reactions bar on click outside
  useEffect(() => {
    if (showReactions === null) return;
    function handleClick() { setShowReactions(null); }
    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => document.addEventListener("click", handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", handleClick); };
  }, [showReactions]);

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
      if (data.ok) { setReply(""); fetchTopic(); }
    } catch {}
    setSubmitting(false);
  }

  async function toggleReaction(postId: number, emoji: string) {
    await fetch("/api/forum/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, emoji }),
    });
    fetchTopic();
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>;
  }

  if (!topic) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Sujet introuvable</p>
        <Link href="/forum" className="text-sm text-gold hover:underline mt-2 block">Retour au forum</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-5">
      {/* Header */}
      <div>
        <Link href={`/forum/${topic.category}`} className="text-xs text-muted hover:text-gold transition-colors flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3 h-3" /> Retour
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {topic.pinned && <Pin className="w-4 h-4 text-gold shrink-0" />}
          {topic.locked && <Lock className="w-4 h-4 text-muted shrink-0" />}
          <h1 className="font-serif text-xl text-white">{topic.title}</h1>
        </div>
        <p className="text-xs text-muted mt-1">
          Par {topic.authorName} · {formatDate(topic.createdAt)} · {topic.postCount} message{topic.postCount > 1 ? "s" : ""}
        </p>
      </div>

      {/* Posts */}
      {posts.map((post, i) => {
        const isOP = i === 0;
        return (
          <div
            key={post.id}
            className={`bg-surface rounded-xl border ${isOP ? "border-gold/20 shadow-[0_0_15px_rgba(200,168,75,0.03)]" : "border-white/[0.07]"} p-5 transition-all hover:border-white/[0.12]`}
          >
            {/* Author line */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(post.authorName)}`}>
                {getInitials(post.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white">{post.authorName}</span>
                {isOP && <span className="text-[9px] ml-1.5 text-gold bg-gold/10 px-1.5 py-0.5 rounded-full font-medium">OP</span>}
              </div>
              <span className="text-[11px] text-muted">{formatDate(post.createdAt)}</span>
            </div>

            {/* Content */}
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>

            {/* Reactions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {post.reactions.map(r => {
                const isMine = myUserId ? r.userIds.includes(myUserId) : false;
                return (
                  <button
                    key={r.emoji}
                    onClick={() => toggleReaction(post.id, r.emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                      isMine
                        ? "bg-gold/20 border border-gold/30 text-gold"
                        : "bg-surface-2 border border-white/[0.07] text-white/60 hover:border-gold/20"
                    }`}
                  >
                    {renderEmoji(r.emoji)}
                    <span className="tabular-nums">{r.count}</span>
                  </button>
                );
              })}

              {/* Add reaction button */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(showReactions === post.id ? null : post.id)}
                  className="w-7 h-7 rounded-full bg-surface-2 border border-white/[0.07] text-muted hover:text-gold hover:border-gold/20 flex items-center justify-center text-xs transition-colors"
                  title="Reagir"
                >
                  +
                </button>
                {showReactions === post.id && (
                  <div className="absolute bottom-9 left-0 z-50 bg-surface border border-white/[0.1] rounded-lg shadow-xl p-1.5 flex gap-1">
                    {QUICK_REACTIONS.map(r => (
                      <button
                        key={r.emoji}
                        onClick={() => { toggleReaction(post.id, r.emoji); setShowReactions(null); }}
                        className="w-8 h-8 rounded hover:bg-white/[0.05] flex items-center justify-center text-lg transition-colors"
                        title={r.label}
                      >
                        {renderEmoji(r.emoji)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Reply form */}
      {!topic.locked ? (
        <div className="bg-surface rounded-xl border border-white/[0.07] p-5">
          <textarea
            placeholder="Votre reponse..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={3}
            className="w-full bg-surface-2 border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted resize-none focus:outline-none focus:border-gold"
          />
          <div className="flex items-center justify-between mt-3">
            <EmojiButton onSelect={emoji => setReply(prev => prev + emoji)} />
            <button
              onClick={handleReply}
              disabled={submitting || !reply.trim()}
              className="h-9 px-5 bg-gold text-night font-semibold rounded-lg text-sm hover:bg-gold/90 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Repondre
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-white/[0.07] p-5 text-center text-sm text-muted">
          🔒 Ce sujet est verrouille
        </div>
      )}
    </div>
  );
}
