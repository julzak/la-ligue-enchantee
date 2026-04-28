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
  deadlines: {
    defaultHour: number;
    earlyMatchHour: number;
    earlyMatchOffsetHours: number;
  };
}

const DEFAULTS: Config = {
  scoring: { goalBonusGk: 10, goalBonusDef: 4, goalBonusMid: 2, goalBonusAtt: 2, cscMalus: -2, penaltySavedBonus: 2 },
  jokers: { regularCount: 4, summerCount: 2, summerDeadline: "2025-09-15" },
  deadlines: { defaultHour: 15, earlyMatchHour: 17, earlyMatchOffsetHours: 2 },
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
            deadlines: data.deadlines ?? DEFAULTS.deadlines,
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

  const { scoring, jokers, deadlines } = config;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-gold" />
          Guide admin
        </h1>
        <p className="text-sm text-muted">Comment utiliser chaque rubrique de l&apos;administration</p>
      </div>

      {/* Scoring */}
      <Section title="Scoring">
        <p className="mb-3">Le total d&apos;un joueur est calcule automatiquement a partir de sa note L&apos;Equipe et des evenements du match. Voici le bareme en vigueur :</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-3">
          <span className="text-muted">But (attaquant ou milieu)</span><span>+{scoring.goalBonusAtt} pts</span>
          <span className="text-muted">But (defenseur)</span><span>+{scoring.goalBonusDef} pts</span>
          <span className="text-muted">But (gardien)</span><span>+{scoring.goalBonusGk} pts</span>
          <span className="text-muted">Passe decisive</span><span>+1 pt</span>
          <span className="text-muted">Contre son camp (CSC)</span><span className="text-rouge">{scoring.cscMalus} pts</span>
          <span className="text-muted">Carton rouge</span><span className="text-rouge">note ramenee a 0, bonus conserves</span>
          <span className="text-muted">Penalty arrete (gardien)</span><span className="text-vert">+{scoring.penaltySavedBonus} pts</span>
          <span className="text-muted">Joueur non note (entre en jeu &lt;45 min)</span><span>2 pts (saisie manuelle admin)</span>
        </div>
        <p className="text-xs text-muted">Certains cas sont a traiter manuellement : un penalty rate se traduit par -1 pt a ajuster sur la note, un carton rouge annule par la commission reste a 0, et un tapis vert donne 5 pts au gagnant et 4 pts au perdant par joueur.</p>
        <p className="text-xs text-muted mt-1">Ces valeurs sont modifiables dans la page <strong className="text-white">Configuration</strong>.</p>
      </Section>

      {/* Deadlines */}
      <Section title="Deadlines">
        <p>Le blocage fonctionne <strong className="text-white">par jour de match</strong>. Pour chaque jour ou des matchs sont programmes (vendredi, samedi, dimanche), les joueurs des clubs qui jouent ce jour-la sont bloques a <strong className="text-white">{deadlines.defaultHour}h</strong>. Si un match est programme avant {deadlines.earlyMatchHour}h ce jour-la, la cloture est avancee a <strong className="text-white">{deadlines.earlyMatchOffsetHours}h avant le coup d&apos;envoi</strong>.</p>
        <p className="mt-2">Exemple : Lens-Toulouse le samedi a 15h, le reste le dimanche. Les joueurs de Lens et Toulouse sont bloques samedi a 13h (2h avant). Les autres joueurs restent modifiables jusqu&apos;au dimanche 15h.</p>
        <p className="mt-2">Le blocage est applique cote serveur : meme si l&apos;interface affiche encore le bouton &quot;Valider&quot;, le serveur refusera la sauvegarde pour les joueurs bloques. Les admins peuvent toujours modifier les equipes via le module admin.</p>
        <p className="text-xs text-muted mt-2">Les heures par defaut sont modifiables dans la page <strong className="text-white">Configuration</strong>.</p>
      </Section>

      {/* Notes */}
      <Section title="Saisie des notes" step="Apres chaque journee de Ligue 1">
        <p>Selectionner la journee dans le menu deroulant. Pour chaque joueur ayant participe au match, renseigner sa <strong className="text-white">note</strong> L&apos;Equipe (1 a 10), ses <strong className="text-white">buts</strong> et ses <strong className="text-white">passes decisives</strong>. Les cases speciales permettent d&apos;indiquer un CSC ({scoring.cscMalus} pts), un carton rouge (note ramenee a 0) ou un penalty arrete (+{scoring.penaltySavedBonus} pts pour les gardiens).</p>
        <p className="mt-2">Le bouton <strong className="text-white">Sauvegarder</strong> enregistre le brouillon sans recalculer les classements. Le bouton <strong className="text-white">Publier</strong> declenche le recalcul complet des classements des trois ligues. On peut publier plusieurs fois sans risque : chaque publication ecrase les classements avec les donnees les plus recentes.</p>
        <p className="mt-2">Le champ <strong className="text-white">Deadline</strong> permet de definir l&apos;heure de cloture pour la journee suivante.</p>
      </Section>

      {/* Matches reportes */}
      <Section title="Matches reportes" step="Quand la LFP annonce un report">
        <p>Sur la page <strong className="text-white">Saisie des notes</strong>, chaque match dispose d&apos;un bouton <strong className="text-white">Reporter</strong>. La gestion d&apos;un report se fait en deux temps.</p>
        <p className="mt-2"><strong className="text-white">1. Des l&apos;annonce du report</strong> (avant qu&apos;on ait la nouvelle date) : cliquer sur <strong className="text-white">Reporter</strong>. Le match passe en bandeau orange et est exclu du calcul de deadline. Effet immediat : les joueurs des deux clubs concernes sont <strong className="text-white">deverrouilles</strong> pour tous les participants, meme si la deadline initiale est passee.</p>
        <p className="mt-2"><strong className="text-white">2. Quand la nouvelle date est connue</strong> : saisir cette date dans l&apos;input du bandeau orange. La deadline se recalcule automatiquement sur la nouvelle date (regle standard : {deadlines.defaultHour}h locale, ou heure du match - {deadlines.earlyMatchOffsetHours}h si coup d&apos;envoi avant {deadlines.earlyMatchHour}h). Les joueurs des deux clubs se reverrouillent a cette nouvelle deadline.</p>
        <p className="mt-2"><strong className="text-white">Annuler un report</strong> : cliquer sur <strong className="text-white">Annuler</strong> dans le bandeau orange. Le calendrier d&apos;origine reprend la main.</p>
        <p className="text-xs text-muted mt-2">Important : le report doit etre enregistre <strong className="text-white">avant</strong> la saisie du score. Si un score est deja saisi pour le match, marquer le match comme reporte n&apos;a aucun effet sur les locks (comportement volontaire pour eviter de debloquer des joueurs apres coup).</p>
        <p className="text-xs text-muted mt-1">Les autres joueurs de l&apos;equipe (clubs non concernes par le report) ne sont pas affectes : ils suivent le calendrier normal.</p>
      </Section>

      {/* Jokers */}
      <Section title="Jokers" step="Sur demande des participants via le forum">
        <p>Selectionner la ligue puis le participant concerne. Choisir le joueur qui <strong className="text-white">sort</strong> de l&apos;effectif, puis rechercher et selectionner le joueur qui <strong className="text-white">entre</strong> (par nom ou par club). Valider pour executer le joker. Le joueur entre sera effectif a partir de la journee suivante.</p>
        <p className="mt-2">Chaque participant dispose de <strong className="text-white">{jokers.regularCount} jokers + {jokers.summerCount} jokers d&apos;aout</strong> par saison. Les jokers doivent etre demandes avant 18h la veille du premier match de la journee. Un joker pris apres cette heure sera valide pour la journee suivante.</p>
        <p className="mt-2">Un joker peut etre annule via le bouton correspondant dans l&apos;historique en bas de page.</p>
      </Section>

      {/* Equipes */}
      <Section title="Equipes" step="Pour corriger la composition d&apos;un participant">
        <p>Selectionner la ligue et la journee, puis cliquer sur <strong className="text-white">Modifier le 11</strong> a cote du participant concerne. L&apos;interface permet de passer les joueurs entre titulaires et remplacants. La composition doit respecter les contraintes habituelles (11 titulaires) avant de pouvoir etre validee.</p>
        <p className="text-xs text-muted mt-2">Utile si un participant n&apos;a pas pu valider sa composition avant la deadline, ou pour corriger une erreur sur une journee passee.</p>
      </Section>

      {/* Coupe */}
      <Section title="Coupe" step="Apres chaque journee de coupe">
        <p>Selectionner la coupe active et verifier que la journee associee a chaque tour est correcte (modifiable via le menu deroulant). Cliquer sur <strong className="text-white">Resoudre</strong> pour comparer les points des deux participants sur cette journee. Le gagnant est avance au tour suivant automatiquement.</p>
        <p className="mt-2">Si le Petit Poucet est active, un bonus est applique automatiquement au participant le moins bien classe (ecart de classement interligue divise par 2). En cas d&apos;egalite parfaite (points et moyenne identiques), c&apos;est le mieux classe a l&apos;interligue qui se qualifie.</p>
        <p className="mt-2">Le bouton <strong className="text-white">Annuler le tour</strong> permet de reinitialiser les resultats d&apos;un tour (utile si les notes ont ete corrigees apres coup). Le bouton <strong className="text-white">Supprimer</strong> efface la coupe en cours pour repartir de zero.</p>
        <p className="text-xs text-muted mt-2">La journee doit etre publiee (via Notes) avant de resoudre un tour de coupe.</p>
      </Section>

      {/* Mercato ete */}
      <Section title="Mercato d&apos;ete" step="En debut de saison">
        <p>Selectionner la ligue et demarrer les encheres. Chaque participant dispose d&apos;un budget de 130 points pour constituer son effectif de 13 joueurs via des encheres aveugles.</p>
        <p className="mt-2">Le cycle est le suivant : <strong className="text-white">ouvrir un tour</strong> pour permettre aux participants d&apos;enchérir, <strong className="text-white">fermer le tour</strong> une fois que tout le monde a mise, puis <strong className="text-white">resoudre</strong> pour attribuer les joueurs aux plus offrants. En cas d&apos;egalite, le joueur et les points sont remis en jeu au tour suivant. Repeter jusqu&apos;a ce que chaque participant ait ses 13 joueurs, puis <strong className="text-white">terminer le mercato</strong>.</p>
      </Section>

      {/* Mercato hiver */}
      <Section title="Mercato d&apos;hiver" step="En milieu de saison (treve hivernale)">
        <p>Meme fonctionnement que le mercato d&apos;ete, mais le budget est calcule automatiquement selon le classement de la ligue (le dernier recoit plus de points que le premier). Chaque recrutement implique la liberation d&apos;un joueur de l&apos;effectif (1 entrant = 1 sortant).</p>
        <p className="text-xs text-muted mt-2">La journee de reference pour le classement et les dates de treve sont configurables dans la page <strong className="text-white">Configuration</strong>.</p>
      </Section>

      {/* Paiements */}
      <Section title="Paiements" step="Suivi des cotisations">
        <p>Cocher chaque participant au fur et a mesure des paiements recus. Le compteur en haut de page affiche le nombre de cotisations recues et le montant restant a collecter. L&apos;etat des cotisations est egalement visible dans la sidebar de chaque page de classement de ligue.</p>
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
