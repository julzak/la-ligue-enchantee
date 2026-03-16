"use client";

const mockComments = [
  { author: "Tom M.", initials: "TM", content: "Les regles sont les memes que l'an dernier, sauf pour les penalties rates qui deviennent -1 pt.", date: "il y a 2 jours" },
  { author: "Pierre L.", initials: "PL", content: "OK pour moi. Par contre on garde le bareme de buts pour les DEF a +4 ?", date: "il y a 2 jours" },
  { author: "Jules B.", initials: "JB", content: "Oui +4 pour les DEF c'est valide. Et +10 pour les GK evidemment.", date: "il y a 1 jour" },
];

export default function TopicPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl text-white mb-1">Règlement saison 2024-2025</h1>
        <p className="text-xs text-muted">Par Tom M. - il y a 2 jours - 3 reponses</p>
      </div>

      <div className="space-y-3">
        {mockComments.map((comment, i) => (
          <div key={i} className="bg-surface rounded-lg border border-white/[0.07] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-surface-2 border border-white/[0.07] flex items-center justify-center text-[9px] font-medium text-white/50">
                {comment.initials}
              </div>
              <span className="text-sm font-medium text-white">{comment.author}</span>
              <span className="text-xs text-muted">{comment.date}</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">{comment.content}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-lg border border-white/[0.07] p-4">
        <textarea
          placeholder="Votre réponse..."
          rows={3}
          className="w-full bg-surface-2 border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted resize-none focus:outline-none focus:border-gold"
        />
        <div className="flex justify-end mt-3">
          <button className="h-9 px-4 bg-gold text-night font-semibold rounded text-sm hover:bg-gold/90 transition-colors">
            Répondre
          </button>
        </div>
      </div>
    </div>
  );
}
