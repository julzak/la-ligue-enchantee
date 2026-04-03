import { Navbar } from "@/components/layout/Navbar";
import { Trophy, Users, BarChart3, Gavel, Shield, BookOpen, Clock } from "lucide-react";

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-white/[0.07] p-6">
      <h2 className="font-serif text-lg text-gold mb-4 flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-gold/70" />
        {title}
      </h2>
      <div className="space-y-3 text-sm text-white/70 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl text-gold mb-3">Guide du site</h1>
            <p className="text-sm text-white/50 max-w-lg mx-auto">
              Tout ce qu&apos;il faut savoir pour utiliser le nouveau site de La Ligue Enchantée.
            </p>
            <p className="text-xs text-white/30 mt-2">
              Connexion : votre nom de participant + mot de passe <strong className="text-white/50">ligue</strong>
            </p>
          </div>

          <div className="space-y-5">

            <Section icon={BarChart3} title="Résultats et classements">
              <p><strong className="text-white">Page d&apos;accueil</strong> :Résumé de la journée en cours, meilleurs et pires joueurs, résultats L1, classement interligue.</p>
              <p><strong className="text-white">Résultats</strong> :Classement de la journée dans votre ligue, leader, progressions et chutes, résumé IA &quot;Lia&quot;.</p>
              <p><strong className="text-white">Général</strong> :Classement cumulé de la saison complète.</p>
              <p><strong className="text-white">Stats</strong> :Classement des joueurs L1 filtrable par poste (Gardiens, Défenseurs, Milieux, Attaquants) et par nombre (10, 20, 50, 100).</p>
            </Section>

            <Section icon={Users} title="Mon équipe">
              <p>Voir votre effectif de 13 joueurs avec photos, club et scores de la dernière journée.</p>
              <p>Choisir vos <strong className="text-white">11 titulaires</strong> en cliquant sur les joueurs. Contraintes de composition : 1 gardien, 3 à 5 défenseurs, 3 à 5 milieux, 1 à 3 attaquants.</p>
              <p><strong className="text-white">Valider avant la deadline</strong> affichée en haut de page. Si pas validé à temps, la composition précédente est reconduite automatiquement.</p>
            </Section>

            <Section icon={Trophy} title="Coupe Enchantée">
              <p>Compétition interligue à élimination directe, accessible depuis la page d&apos;accueil.</p>
              <p>Bracket complet : préliminaire → seizièmes → huitièmes → quarts → demi-finales → finale.</p>
              <p><strong className="text-white">Règle du Petit Poucet</strong> :L&apos;équipe moins bien classée au classement interligue reçoit un bonus de points proportionnel à l&apos;écart de classement.</p>
            </Section>

            <Section icon={Gavel} title="Mercato">
              <p>Quand le mercato est ouvert, un bandeau apparaît sur toutes les pages. Cliquez dessus pour accéder à la page d&apos;enchères.</p>
              <p><strong className="text-white">Mercato d&apos;été</strong> :130 points de budget identique pour tous. Enchères aveugles : le plus offrant remporte le joueur. En cas d&apos;égalité, le joueur et les points sont remis en jeu au tour suivant.</p>
              <p><strong className="text-white">Mercato d&apos;hiver</strong> :Budget proportionnel au classement (le dernier reçoit le plus). Chaque recrutement implique la libération d&apos;un joueur de votre effectif (1 entrant = 1 sortant).</p>
            </Section>

            <Section icon={Shield} title="Scoring">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <span className="text-white/50">Note L&apos;Équipe</span><span>1 à 10 pts</span>
                <span className="text-white/50">But (ATT / MIL)</span><span>+2 pts</span>
                <span className="text-white/50">But (DEF)</span><span>+4 pts</span>
                <span className="text-white/50">But (GK)</span><span>+10 pts</span>
                <span className="text-white/50">Passe décisive</span><span>+1 pt</span>
                <span className="text-white/50">CSC</span><span className="text-rouge">-2 pts</span>
                <span className="text-white/50">Carton rouge</span><span className="text-rouge">Note → 0</span>
                <span className="text-white/50">Penalty arrêté (GK)</span><span className="text-vert">+2 pts</span>
                <span className="text-white/50">Joueur non noté</span><span>2 pts forfait</span>
              </div>
            </Section>

            <Section icon={BookOpen} title="Jokers">
              <p>Chaque participant dispose de <strong className="text-white">4 jokers + 2 jokers d&apos;août</strong> par saison pour remplacer un joueur de son effectif.</p>
              <p>Les jokers sont à poster dans le sujet &quot;Jokers&quot; dédié à chaque ligue sur le forum.</p>
              <p>Pour être validé pour la journée à venir, le joker doit être pris <strong className="text-white">avant 18h la veille du premier match</strong> de la journée. Un joker pris après 18h sera pris en compte pour la journée suivante.</p>
            </Section>

            <Section icon={Clock} title="Validation des équipes">
              <p>Les équipes doivent être validées selon les horaires suivants :</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong className="text-white">Tous les jours</strong> : validation avant 15h le jour du match</li>
                <li><strong className="text-white">Match avant 17h</strong> : validation 2h avant le coup d&apos;envoi du 1er match</li>
              </ul>
              <p className="mt-2 text-white/40 text-xs italic">Merci de respecter ces horaires même si le blocage n&apos;a pas encore été effectué par les admins.</p>
            </Section>

          </div>
        </div>
      </div>
    </>
  );
}
