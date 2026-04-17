"use client";

import { useState, useEffect } from "react";
import { Users, ExternalLink } from "lucide-react";

interface League { id: number; dbId: number; name: string; slug: string }
interface Participant { id: number; cleanName: string }

export default function AdminEquipesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [currentDay, setCurrentDay] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    fetch("/api/admin/jokers/leagues")
      .then((r) => r.json())
      .then((d) => setLeagues(d.leagues ?? []))
      .catch(() => {});
    // Fetch current matchday
    fetch("/api/admin/deadline")
      .then((r) => r.json())
      .then((d) => {
        const day = d.day ?? 27;
        setCurrentDay(day);
        setSelectedDay(day);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedLeague) return;
    const league = leagues.find((l) => l.dbId === selectedLeague);
    setSelectedSlug(league?.slug ?? "");
    fetch(`/api/admin/jokers/participants?leagueId=${selectedLeague}`)
      .then((r) => r.json())
      .then((d) => {
        const sorted = (d.participants ?? []).sort((a: { cleanName: string }, b: { cleanName: string }) =>
          a.cleanName.localeCompare(b.cleanName, "fr")
        );
        setParticipants(sorted);
      })
      .catch(() => {});
  }, [selectedLeague, leagues]);

  const dayOptions = Array.from({ length: 38 }, (_, i) => i + 1);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Users className="w-6 h-6 text-gold" />
          Gestion des équipes
        </h1>
        <p className="text-sm text-muted">Modifier la composition de n&apos;importe quel participant</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={selectedLeague}
          onChange={(e) => setSelectedLeague(Number(e.target.value))}
          className="bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
        >
          <option value={0}>Sélectionner une ligue</option>
          {leagues.map((l) => (
            <option key={l.dbId} value={l.dbId}>{l.name}</option>
          ))}
        </select>

        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          className="bg-surface-2 border border-white/[0.07] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
        >
          {dayOptions.map((d) => (
            <option key={d} value={d}>
              Journée {d}{d === currentDay ? " (en cours)" : d === currentDay + 1 ? " (prochaine)" : ""}
            </option>
          ))}
        </select>
      </div>

      {participants.length > 0 && (
        <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden">
          <div className="bg-surface-2 px-4 py-2 border-b border-white/[0.07]">
            <span className="text-sm text-white font-medium">{participants.length} participants</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02]">
                <span className="text-sm text-white">{p.cleanName}</span>
                <div className="flex gap-2">
                  <a
                    href={`/ligue/${selectedSlug}/equipe/${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted hover:text-gold flex items-center gap-1 transition-colors"
                  >
                    Voir <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`/admin/equipes/${p.id}?league=${selectedSlug}&leagueId=${selectedLeague}&day=${selectedDay}`}
                    className="text-xs bg-gold/10 text-gold px-2 py-1 rounded hover:bg-gold/20 transition-colors"
                  >
                    Modifier le 11 (J{selectedDay})
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
