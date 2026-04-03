"use client";

import { useState, useEffect } from "react";
import { BookOpen, Loader2 } from "lucide-react";

interface Config {
  scoring: {
    goalBonusGk: number;
    goalBonusDef: number;
    goalBonusMid: number;
    goalBonusAtt: number;
    cscMalus: number;
    penaltySavedBonus: number;
  };
  jokers: {
    regularCount: number;
    summerCount: number;
    summerDeadline: string;
  };
}

const DEFAULTS: Config = {
  scoring: { goalBonusGk: 10, goalBonusDef: 4, goalBonusMid: 2, goalBonusAtt: 2, cscMalus: -2, penaltySavedBonus: 2 },
  jokers: { regularCount: 4, summerCount: 2, summerDeadline: "2025-09-15" },
};

export default function AdminGuidePage() {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/config");
        if (res.ok) {
          const data = await res.json();
          setConfig({
            scoring: data.scoring ?? DEFAULTS.scoring,
            jokers: data.jokers ?? DEFAULTS.jokers,
          });
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  const { scoring, jokers } = config;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-gold" />
          Guide admin
        </h1>
        <p className="text-sm text-muted">Comment utiliser chaque rubrique de l&apos;administration</p>
      </div>

      {/* Scoring automatique */}
      <Section title="Scoring automatique">
        <p className="mb-2">Les bonus/malus suivants sont calcules automatiquement a partir des donnees saisies :</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-muted">But (ATT/MIL)</span><span>+{scoring.goalBonusAtt} pts</span>
          <span className="text-muted">But (DEF)</span><span>+{scoring.goalBonusDef} pts</span>
          <span className="text-muted">But (GK)</span><span>+{scoring.goalBonusGk} pts</span>
          <span className="text-muted">Passe decisive</span><span>+1 pt</span>
          <span className="text-muted">CSC</span><span className="text-rouge">{scoring.cscMalus} pts</span>
          <span className="text-muted">Carton rouge</span><span className="text-rouge">Note &rarr; 0 (bonus conserves)</span>
          <span className="text-muted">Penalty arrete (GK)</span><span className="text-vert">+{scoring.penaltySavedBonus} pts</span>
          <span className="text-muted">Non note / forfait</span><span>2 pts</span>
        </div>
        <p className="text-xs text-muted mt-3"><strong className="text-white">Exceptions manuelles :</strong> Penalty rate (-1 pt) &rarr; ajuster la note. Carton rouge annule par la commission &rarr; garder 0. Tapis vert &rarr; 5 pts gagnant / 4 pts perdant par joueur.</p>
      </Section>

      {/* Deadlines de validation */}
      <Section title="Deadlines de validation des equipes">
        <ul className="list-disc list-inside space-y-1">
          <li><strong className="text-white">Match le vendredi</strong> : validation avant 15h le vendredi</li>
          <li><strong className="text-white">Matchs le samedi</strong> : validation avant 15h le samedi</li>
          <li><strong className="text-white">Matchs le dimanche</strong> : validation avant 15h le dimanche</li>
          <li><strong className="text-white">Match en semaine</strong> : validation 2h avant le coup d&apos;envoi du 1er match du jour, puis entierement a 15h le jour suivant</li>
        </ul>
        <p className="text-xs text-muted mt-2">La deadline est calculee automatiquement a partir du calendrier TheSportsDB. Elle peut etre modifiee manuellement dans la page Notes (champ date/heure a cote du selecteur de journee).</p>
      </Section>

      {/* Notes */}
      <Section title="Notes" step="Apres chaque journee de L1">
        <ol className="list-decimal list-inside space-y-2">
          <li>Selectionner la journee dans le dropdown</li>
          <li>Pour chaque joueur ayant joue, saisir : <strong>Note</strong> (L&apos;Equipe 1-10), <strong>But</strong>, <strong>Pas</strong> (passes decisives)</li>
          <li>Cases speciales : <strong>CSC</strong> ({scoring.cscMalus} pts), <strong>&#x1F7E5;</strong> (carton rouge = note &rarr; 0), <strong>Pen</strong> (penalty arrete par GK = +{scoring.penaltySavedBonus} pts)</li>
          <li><strong>Deadline</strong> : definir la date/heure limite de validation des equipes pour la journee suivante</li>
          <li><strong>Sauvegarder</strong> pour enregistrer le brouillon</li>
          <li><strong>Publier</strong> quand tout est saisi : recalcule automatiquement tous les classements des 3 ligues</li>
        </ol>
        <p className="text-xs text-muted mt-2">On peut publier plusieurs fois. Chaque publication ecrase les classements avec les donnees a jour.</p>
      </Section>

      {/* Jokers */}
      <Section title="Jokers" step="Sur demande des participants (via le forum)">
        <ol className="list-decimal list-inside space-y-2">
          <li>Selectionner la ligue</li>
          <li>Selectionner le participant qui demande le joker</li>
          <li>Choisir le joueur qui <strong>sort</strong> de l&apos;effectif</li>
          <li>Chercher et selectionner le joueur qui <strong>entre</strong></li>
          <li>Valider le joker</li>
        </ol>
        <p className="text-xs text-muted mt-2">Regle : <strong className="text-white">{jokers.regularCount} jokers + {jokers.summerCount} jokers d&apos;aout</strong> par saison. Deadline : 18h la veille du premier match de la journee. Un joker pris apres 18h sera valide pour la journee suivante.</p>
      </Section>

      {/* Equipes */}
      <Section title="Equipes" step="Pour corriger la composition d'un participant">
        <ol className="list-decimal list-inside space-y-2">
          <li>Selectionner la ligue</li>
          <li>Cliquer sur &quot;Modifier le 11&quot; a cote du participant</li>
          <li>Cliquer sur les joueurs pour les passer titulaire/remplacant</li>
          <li>Respecter les contraintes de composition (voir ci-dessus)</li>
          <li>Valider quand la composition est valide (11 titulaires)</li>
        </ol>
        <p className="text-xs text-muted mt-2">Utile si un participant n&apos;a pas pu valider sa composition avant la deadline.</p>
      </Section>

      {/* Coupe */}
      <Section title="Coupe" step="Apres chaque journee de coupe">
        <ol className="list-decimal list-inside space-y-2">
          <li>Selectionner la coupe active</li>
          <li>Verifier que la <strong>journee</strong> (Jxx) est correcte pour chaque tour (modifiable via le dropdown)</li>
          <li>Cliquer <strong>&quot;Resoudre&quot;</strong> : le systeme compare les points des 2 participants pour cette journee</li>
          <li>Si le Petit Poucet est active, le bonus est applique automatiquement (ecart classement / 2)</li>
          <li>Le vainqueur est avance au tour suivant automatiquement</li>
          <li>En cas d&apos;egalite parfaite : utiliser le bouton &quot;Tirage au sort&quot;</li>
        </ol>
        <p className="text-xs text-muted mt-2">Important : la journee doit etre <strong className="text-white">publiee</strong> (via Notes) AVANT de resoudre un tour de coupe.</p>
      </Section>

      {/* Encheres ete */}
      <Section title="Mercato d'ete" step="En debut de saison">
        <ol className="list-decimal list-inside space-y-2">
          <li>Selectionner la ligue</li>
          <li><strong>Demarrer les encheres</strong> : ouvre le tour 1 (chaque participant a 130 pts de budget)</li>
          <li>Les participants encherissent depuis leur page ligue (encheres aveugles)</li>
          <li><strong>Fermer le tour</strong> quand tous ont encheri</li>
          <li><strong>Resoudre le tour</strong> : le plus offrant remporte le joueur. Egalite = joueur et points remis en jeu</li>
          <li><strong>Ouvrir tour suivant</strong> pour les joueurs non attribues</li>
          <li>Repeter jusqu&apos;a ce que chaque participant ait 13 joueurs</li>
          <li><strong>Terminer l&apos;enchere</strong> quand tout est complet</li>
        </ol>
      </Section>

      {/* Mercato hiver */}
      <Section title="Mercato d'hiver" step="En milieu de saison">
        <ol className="list-decimal list-inside space-y-2">
          <li>Selectionner la ligue</li>
          <li><strong>Ouvrir le mercato</strong> : le budget est calcule automatiquement selon le classement (1er = 10 pts, 18e = 44 pts)</li>
          <li>Meme fonctionnement que le mercato d&apos;ete</li>
          <li>Chaque recrutement implique la liberation d&apos;un joueur (1 IN = 1 OUT)</li>
        </ol>
      </Section>

      {/* Paiements */}
      <Section title="Paiements" step="Suivi des cotisations (30 euros)">
        <ol className="list-decimal list-inside space-y-2">
          <li>Cocher/decocher chaque participant quand il a paye sa cotisation</li>
          <li>Le montant collecte et restant se met a jour automatiquement</li>
        </ol>
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
