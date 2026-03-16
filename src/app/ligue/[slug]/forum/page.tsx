"use client";

import { Pin } from "lucide-react";
import Link from "next/link";

interface Topic {
  id: string;
  title: string;
  author: string;
  replies: number;
  pinned: boolean;
  lastReply: string;
  lastPoster: string;
  preview: string;
  reclamationStatus?: "en_cours" | "rejetee";
}

const mockTopics: Topic[] = [
  {
    id: "1",
    title: "Règlement saison 2024-2025",
    author: "Tom M.",
    replies: 12,
    pinned: true,
    lastReply: "il y a 2 jours",
    lastPoster: "Pierre L.",
    preview: "Petit rappel : les transferts sont limités à 2 par journée, et les jokers ne sont utilisables qu'une fois par mois.",
  },
  {
    id: "2",
    title: "Mercato hiver - vos coups",
    author: "Pierre L.",
    replies: 24,
    pinned: false,
    lastReply: "il y a 3h",
    lastPoster: "Antoine G.",
    preview: "J'ai pris Greenwood à 8M, honnêtement c'est le steal de la saison. Il va finir meilleur buteur.",
  },
  {
    id: "3",
    title: "J26 - les notes L'Équipe sont généreuses",
    author: "Jules B.",
    replies: 8,
    pinned: false,
    lastReply: "hier",
    lastPoster: "Maxime D.",
    preview: "Un 7 pour Barcola qui a touché 30 ballons et raté 2 occasions ? On nage en plein délire.",
  },
  {
    id: "4",
    title: "Réclamation : Fofana noté 4 mais devrait être 3",
    author: "Maxime D.",
    replies: 3,
    pinned: false,
    lastReply: "il y a 5h",
    lastPoster: "Tom M.",
    preview: "Il est sorti à la 35e blessé, pas de tacle réussi, un carton jaune. C'est un 3 maximum.",
    reclamationStatus: "en_cours",
  },
  {
    id: "5",
    title: "Pronostics J27",
    author: "Antoine G.",
    replies: 6,
    pinned: false,
    lastReply: "il y a 1h",
    lastPoster: "Jules B.",
    preview: "PSG-Lyon : 3-1, Marseille-Lille : 1-1, Monaco-Rennes : 2-0. Qui me suit ?",
  },
  {
    id: "6",
    title: "Réclamation : match Nantes annulé pas pris en compte",
    author: "Pierre L.",
    replies: 15,
    pinned: false,
    lastReply: "il y a 1 jour",
    lastPoster: "Tom M.",
    preview: "Le match a été reporté mais mes joueurs nantais ont quand même pris 0. C'est injuste.",
    reclamationStatus: "rejetee",
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

export default function ForumPage() {
  const pinned = mockTopics.filter((t) => t.pinned);
  const regular = mockTopics.filter((t) => !t.pinned);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-white mb-1">Forum</h1>
          <p className="text-sm text-muted">Discussions de la ligue</p>
        </div>
        <button className="h-9 px-4 bg-gold text-night font-medium rounded text-sm hover:bg-gold/90 transition-colors font-serif">
          Nouveau sujet
        </button>
      </div>

      {/* Pinned topics */}
      {pinned.length > 0 && (
        <div className="space-y-2">
          {pinned.map((topic) => (
            <Link
              key={topic.id}
              href={`/ligue/ligue-2/forum/${topic.id}`}
              className="block bg-surface rounded-lg border border-white/[0.07] border-l-2 border-l-gold overflow-hidden hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-4 px-4 py-4">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(topic.lastPoster)}`}
                >
                  {getInitials(topic.lastPoster)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Pin className="w-3.5 h-3.5 text-gold shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">{topic.title}</span>
                    {topic.replies > 10 && <span className="shrink-0" title="Sujet populaire">🔥</span>}
                  </div>
                  <p className="text-xs text-muted/70 line-clamp-1 mb-1.5">{topic.preview}</p>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>Par {topic.author}</span>
                    <span className="text-white/20">·</span>
                    <span>{topic.replies} réponses</span>
                    <span className="text-white/20">·</span>
                    <span>Dernier : {topic.lastPoster}, {topic.lastReply}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Regular topics */}
      <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden divide-y divide-white/[0.07]">
        {regular.map((topic) => {
          const isHot = topic.replies > 10;
          const isReclamation = topic.title.toLowerCase().includes("réclamation");

          return (
            <Link
              key={topic.id}
              href={`/ligue/ligue-2/forum/${topic.id}`}
              className="flex items-start gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(topic.lastPoster)}`}
              >
                {getInitials(topic.lastPoster)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{topic.title}</span>
                  {isHot && <span className="shrink-0" title="Sujet populaire">🔥</span>}
                  {isReclamation && topic.reclamationStatus && (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                        topic.reclamationStatus === "en_cours"
                          ? "bg-gold/15 text-gold"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {topic.reclamationStatus === "en_cours" ? "En cours" : "Rejetée"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted/70 line-clamp-1 mb-1.5">{topic.preview}</p>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>Par {topic.author}</span>
                  <span className="text-white/20">·</span>
                  <span>{topic.replies} réponses</span>
                  <span className="text-white/20">·</span>
                  <span>Dernier : {topic.lastPoster}, {topic.lastReply}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
