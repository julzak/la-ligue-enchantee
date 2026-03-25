"use client";

import { BookOpen } from "lucide-react";

export default function AdminGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-gold" />
          Guide admin
        </h1>
        <p className="text-sm text-muted">Comment utiliser chaque rubrique de l&apos;administration</p>
      </div>

      {/* Notes */}
      <Section title="Notes" step="Après chaque journée de L1">
        <ol className="list-decimal list-inside space-y-2">
          <li>Sélectionner la journée dans le dropdown</li>
          <li>Pour chaque joueur ayant joué, saisir : <strong>Note</strong> (L&apos;Équipe 1-10), <strong>But</strong>, <strong>Pas</strong> (passes décisives)</li>
          <li>Cases spéciales : <strong>CSC</strong> (-2 pts), <strong>🟥</strong> (carton rouge = note remplacée par 0), <strong>Pen</strong> (penalty arrêté par GK = +2 pts)</li>
          <li><strong>Deadline</strong> : définir la date/heure limite de validation des équipes pour la journée suivante (calculée automatiquement mais modifiable)</li>
          <li><strong>Sauvegarder</strong> pour enregistrer le brouillon</li>
          <li><strong>Publier</strong> quand tout est saisi : recalcule automatiquement tous les classements des 3 ligues</li>
        </ol>
        <p className="text-xs text-muted mt-2">On peut publier plusieurs fois. Chaque publication écrase les classements avec les données à jour.</p>
      </Section>

      {/* Jokers */}
      <Section title="Jokers" step="Sur demande des participants (via le forum)">
        <ol className="list-decimal list-inside space-y-2">
          <li>Sélectionner la ligue</li>
          <li>Sélectionner le participant qui demande le joker</li>
          <li>Choisir le joueur qui <strong>sort</strong> de l&apos;effectif</li>
          <li>Chercher et sélectionner le joueur qui <strong>entre</strong></li>
          <li>Valider le joker</li>
        </ol>
        <p className="text-xs text-muted mt-2">Règle : 4 jokers + 2 jokers d&apos;août par saison. Deadline : 18h la veille du premier match de la journée.</p>
      </Section>

      {/* Équipes */}
      <Section title="Équipes" step="Pour corriger la composition d&apos;un participant">
        <ol className="list-decimal list-inside space-y-2">
          <li>Sélectionner la ligue</li>
          <li>Cliquer sur &quot;Modifier le 11&quot; à côté du participant</li>
          <li>Cliquer sur les joueurs pour les passer titulaire/remplaçant</li>
          <li>Respecter les contraintes : 1 GK, 3-5 DEF, 3-5 MIL, 1-3 ATT</li>
          <li>Valider quand la composition est valide (11 titulaires)</li>
        </ol>
        <p className="text-xs text-muted mt-2">Utile si un participant n&apos;a pas pu valider sa composition avant la deadline.</p>
      </Section>

      {/* Coupe */}
      <Section title="Coupe" step="Après chaque journée de coupe">
        <ol className="list-decimal list-inside space-y-2">
          <li>Sélectionner la coupe active</li>
          <li>Vérifier que la <strong>journée</strong> (Jxx) est correcte pour chaque tour</li>
          <li>Cliquer <strong>&quot;Résoudre&quot;</strong> : le système compare les points des 2 participants pour cette journée, applique le bonus Petit Poucet si activé, et fait avancer le vainqueur au tour suivant</li>
          <li>En cas d&apos;égalité parfaite : le &quot;tirage au sort&quot; peut être utilisé</li>
        </ol>
        <p className="text-xs text-muted mt-2">Important : la journée doit être publiée (via Notes) AVANT de résoudre un tour de coupe.</p>
      </Section>

      {/* Enchères été */}
      <Section title="Mercato d&apos;été" step="En début de saison">
        <ol className="list-decimal list-inside space-y-2">
          <li>Sélectionner la ligue</li>
          <li><strong>Démarrer les enchères</strong> : ouvre le tour 1 (chaque participant a 130 pts de budget)</li>
          <li>Les participants enchérissent depuis leur page ligue (enchères aveugles)</li>
          <li><strong>Fermer le tour</strong> quand tous ont enchéri</li>
          <li><strong>Résoudre le tour</strong> : le plus offrant remporte le joueur. En cas d&apos;égalité, joueur et points sont remis en jeu</li>
          <li><strong>Ouvrir tour suivant</strong> pour les joueurs non attribués</li>
          <li>Répéter jusqu&apos;à ce que chaque participant ait 13 joueurs</li>
          <li><strong>Terminer l&apos;enchère</strong> quand tout est complet</li>
        </ol>
      </Section>

      {/* Mercato hiver */}
      <Section title="Mercato d&apos;hiver" step="En milieu de saison">
        <ol className="list-decimal list-inside space-y-2">
          <li>Sélectionner la ligue</li>
          <li><strong>Ouvrir le mercato</strong> : le budget est calculé automatiquement selon le classement (1er = 10 pts, dernier = 44 pts)</li>
          <li>Même fonctionnement que le mercato d&apos;été mais chaque recrutement implique la libération d&apos;un joueur (1 IN = 1 OUT)</li>
        </ol>
      </Section>

      {/* Paiements */}
      <Section title="Paiements" step="Suivi des cotisations">
        <ol className="list-decimal list-inside space-y-2">
          <li>Cocher/décocher chaque participant quand il a payé sa cotisation</li>
          <li>Le montant collecté et restant se met à jour automatiquement</li>
        </ol>
      </Section>

      {/* Scoring */}
      <Section title="Rappel du scoring">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-muted">Note L&apos;Équipe</span><span>1-10 pts</span>
          <span className="text-muted">But (ATT/MIL)</span><span>+2 pts</span>
          <span className="text-muted">But (DEF)</span><span>+4 pts</span>
          <span className="text-muted">But (GK)</span><span>+10 pts</span>
          <span className="text-muted">Passe décisive</span><span>+1 pt</span>
          <span className="text-muted">CSC</span><span className="text-rouge">-2 pts</span>
          <span className="text-muted">Carton rouge</span><span className="text-rouge">Note → 0</span>
          <span className="text-muted">Penalty arrêté (GK)</span><span className="text-vert">+2 pts</span>
          <span className="text-muted">Non noté / forfait</span><span>2 pts</span>
        </div>
        <p className="text-xs text-muted mt-3"><strong>Exceptions manuelles :</strong> Penalty raté (-1 pt) → ajuster la note. Carton rouge annulé → garder 0. Tapis vert → 5 pts gagnant / 4 pts perdant.</p>
      </Section>
    </div>
  );
}

function Section({ title, step, children }: { title: string; step?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
      <h2 className="font-serif text-base text-gold mb-1">{title}</h2>
      {step && <p className="text-xs text-muted mb-3 italic">{step}</p>}
      <div className="text-sm text-white/70 space-y-2">{children}</div>
    </div>
  );
}
