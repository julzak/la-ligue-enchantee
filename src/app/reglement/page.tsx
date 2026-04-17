"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function ReglementPage() {
  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <main className="max-w-3xl mx-auto px-4 md:px-6 py-10">
          <h1 className="font-serif text-2xl sm:text-3xl text-gold mb-2">
            Règlement
          </h1>
          <p className="text-xs text-muted mb-8">La Ligue Enchantée - Saison 2025-2026</p>

          <div className="space-y-8 text-sm text-white/80 leading-relaxed">
            {/* Introduction */}
            <Section title="Le concept">
              <p>
                La Ligue Enchantée est un jeu de management de football sur Internet fondé sur la réalité du
                Championnat de France de Ligue 1. Le jeu rassemble des Ligues composées de 20 membres maximum
                (minimum 10).
              </p>
              <p>
                Chaque joueur dispose d&apos;un budget de <strong className="text-white">130 points</strong> lui
                permettant d&apos;acquérir des joueurs réels lors d&apos;enchères fermées. En fonction de leurs
                performances réelles (notes L&apos;Équipe, buts, passes), les joueurs rapportent des points
                après chaque journée.
              </p>
              <p>
                À l&apos;issue de la 38e journée, est déclaré vainqueur le participant ayant le plus
                grand nombre de points. En cas d&apos;égalité, les participants ne sont pas départagés.
              </p>
            </Section>

            {/* Enchères */}
            <Section title="1. Enchères du mercato d&apos;été">
              <p>
                Chaque participant mise ses 130 points sur 13 joueurs issus du championnat de France
                et envoie sa liste avant la date butoir. Le recrutement s&apos;effectue par rounds successifs
                d&apos;enchères fermées.
              </p>
              <p>Règles d&apos;attribution :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Lorsque plusieurs participants misent sur le même joueur, le plus offrant l&apos;emporte</li>
                <li>En cas de mises égales, le joueur n&apos;est attribué à personne et est remis en jeu au tour suivant</li>
                <li>Les points misés sur des joueurs non obtenus sont récupérés pour le tour suivant</li>
              </ul>
              <p>
                Un seul et unique gardien de club doit être choisi par équipe. On choisit les
                &quot;Gardiens [Club]&quot; (pas un gardien individuel) : si le titulaire est absent,
                son remplaçant rapporte les points.
              </p>
            </Section>

            {/* Composition */}
            <Section title="2. Composition d&apos;équipe">
              <p>
                Chaque équipe est composée de <strong className="text-white">13 joueurs</strong> dont
                11 titulaires et 2 remplaçants.
              </p>
              <h3 className="text-white font-medium mt-3 mb-1">Effectif de 13 joueurs</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>1 gardien</li>
                <li>Entre 3 et 6 défenseurs</li>
                <li>Entre 3 et 6 milieux</li>
                <li>Entre 1 et 4 attaquants</li>
              </ul>
              <h3 className="text-white font-medium mt-3 mb-1">11 titulaires chaque journée</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>1 gardien</li>
                <li>Minimum 3 défenseurs</li>
                <li>Minimum 3 milieux</li>
                <li>Entre 1 et 3 attaquants</li>
              </ul>
              <p>
                La classification utilisée est celle de l&apos;explorateur du site.
                Seuls les 11 titulaires rapportent des points.
              </p>
            </Section>

            {/* Choix des titulaires */}
            <Section title="3. Choix des titulaires">
              <p>
                Avant chaque journée, les participants choisissent leurs 11 titulaires.
                L&apos;heure limite est fixée à <strong className="text-white">2h avant le coup d&apos;envoi
                du premier match</strong> de la journée.
              </p>
              <p>
                Habituellement : vendredi 18h pour le match du vendredi, samedi 13h pour les matchs
                de 15h, dimanche 11h pour les matchs de 13h. Multiplex du dimanche : 15h.
              </p>
            </Section>

            {/* Système de points */}
            <Section title="4. Calcul des points">
              <p>
                Les points proviennent des notes L&apos;Équipe (édition papier du lendemain) et de primes/pénalités :
              </p>

              <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden mt-3">
                <div className="divide-y divide-white/[0.05]">
                  <PointRule label="Note de base" desc="Note L'Équipe (sur 10)" />
                  <PointRule label="Joueur entré en jeu mais non noté (<45 min)" desc="Forfait : 2 pts (saisie admin)" />
                  <PointRule label="Joueur n'ayant pas joué" desc="0 pt" />
                  <PointRule label="Carton rouge" desc="Note ramenée à 0, primes conservées" />
                  <PointRule label="But (Gardien)" desc="+10 pts" />
                  <PointRule label="But (Défenseur)" desc="+4 pts" />
                  <PointRule label="But (Milieu / Attaquant)" desc="+2 pts" />
                  <PointRule label="Passe décisive" desc="+1 pt" />
                  <PointRule label="Pénalty arrêté (Gardien)" desc="+2 pts" />
                  <PointRule label="But contre son camp (CSC)" desc="-2 pts" />
                </div>
              </div>

              <p className="mt-3">
                <strong className="text-white">Carton rouge :</strong> le maintien du 0 est conservé même si
                la commission de discipline annule le carton.
              </p>
              <p>
                <strong className="text-white">Passes décisives :</strong> seules les passes mentionnées
                dans la parenthèse après la minute du but dans l&apos;encadré L&apos;Équipe sont comptabilisées.
              </p>
              <p>
                <strong className="text-white">Tapis vert (match non joué avec feuille de match) :</strong> 5 pts
                aux titulaires du gagnant, 4 pts à ceux du perdant, 2 pts aux remplaçants.
              </p>
            </Section>

            {/* Jokers */}
            <Section title="5. Jokers">
              <p>Chaque participant dispose de :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-white">2 jokers &quot;Août&quot;</strong> valables uniquement avant le 1er septembre</li>
                <li><strong className="text-white">4 jokers</strong> valables toute l&apos;année</li>
              </ul>
              <p>
                Un joker permet de remplacer un joueur de son effectif par un joueur libre
                (visible dans l&apos;explorateur club par club). Le joker doit être signalé sur le forum
                de la ligue (topic &quot;Joker&quot;) au plus tard la veille de la journée à 18h.
              </p>
              <p>
                Les jokers sont bloqués pendant la trêve hivernale (fermeture entre la 19e journée et
                la fin du mercato d&apos;hiver).
              </p>
            </Section>

            {/* Mercato d'hiver */}
            <Section title="6. Mercato d&apos;hiver">
              <p>
                Un mercato d&apos;hiver permet de renforcer son effectif pendant la trêve.
                Le budget est inversement proportionnel au classement à la 19e journée :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>1er : 10 pts de budget</li>
                <li>2e : 12 pts, 3e : 14 pts, etc. (+2 par rang)</li>
                <li>Dernier (20e) : 48 pts</li>
              </ul>
              <p>
                Le mercato fonctionne par enchères fermées sur 3 tours. Pour chaque joueur acquis,
                le participant doit désigner un joueur à libérer.
              </p>
            </Section>

            {/* Coupe */}
            <Section title="7. Coupe Enchantée">
              <p>
                Compétition à élimination directe inter-ligues. Le tableau est issu d&apos;un tirage
                au sort intégral. Chaque tour correspond à une journée de championnat.
              </p>
              <p>
                Le participant qualifié est celui ayant réalisé le meilleur score sur la journée donnée.
              </p>
              <p>
                <strong className="text-white">Règle du Petit Poucet :</strong> la différence de classement
                interligue entre les deux participants est divisée par 2 (arrondie à l&apos;inférieur)
                et ajoutée au score du moins bien classé.
              </p>
              <p>
                En cas d&apos;égalité : match de barrage. Si nouvelle égalité, le mieux classé en
                interligue est qualifié.
              </p>
              <p>
                <strong className="text-white">Dotation :</strong> 30 euros par ligue. Le vainqueur
                et le finaliste se partagent 2/3 - 1/3.
              </p>
            </Section>

            {/* Gains */}
            <Section title="8. Gains et montées/descentes">
              <p>
                Le pot de chaque ligue est réparti entre le trio de tête :
                <strong className="text-white"> 60% / 30% / 10%</strong>.
              </p>
              <p>
                Les 3 premiers de chaque ligue montent en division supérieure, les 3 derniers
                descendent. Ces mouvements sont ajustés en fonction des éventuels abandons.
              </p>
            </Section>

            {/* Cotisation */}
            <Section title="9. Cotisation">
              <p>
                Chaque participant s&apos;acquitte d&apos;une cotisation de <strong className="text-white">30 euros</strong> :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>20 euros redistribués au trio de tête + coupe</li>
                <li>1,50 euro reversé pour les finalistes de la coupe</li>
                <li>8,50 euros pour les frais (hébergement, développement)</li>
              </ul>
            </Section>

            {/* Forum */}
            <Section title="10. Forum">
              <p>
                Le forum est le lieu de vie de la Ligue. Chaque ligue a son propre espace.
                Deux topics importants à respecter :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-white">Topic &quot;Joker&quot;</strong> : exclusivement pour les demandes de joker</li>
                <li><strong className="text-white">Topic &quot;Réclamations&quot;</strong> : pour signaler les erreurs de notation</li>
              </ul>
              <p>
                Chambrage et discussions footballistiques pointues sont les bienvenues !
              </p>
            </Section>
          </div>
        </main>

        <footer className="border-t border-white/[0.07] py-6 text-center">
          <Link href="/" className="text-sm text-gold hover:underline">
            Accueil
          </Link>
          <span className="text-muted text-sm mx-3">|</span>
          <span className="text-muted text-sm">La Ligue Enchantée - Saison 2025-2026</span>
        </footer>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-lg text-white mb-3 border-b border-white/[0.07] pb-2">
        {title}
      </h2>
      <div className="space-y-3">
        {children}
      </div>
    </section>
  );
}

function PointRule({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-white font-medium">{label}</span>
      <span className="text-gold tabular-nums">{desc}</span>
    </div>
  );
}
