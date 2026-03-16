"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function ReglementPage() {
  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <main className="max-w-3xl mx-auto px-4 md:px-6 py-10">
          <h1 className="font-serif text-2xl sm:text-3xl text-gold mb-8">
            Règlement Saison 2025-2026
          </h1>

          <div className="space-y-8 text-sm text-white/80 leading-relaxed">
            {/* Principe du jeu */}
            <Section title="Principe du jeu">
              <p>
                La Ligue Enchantée est un jeu de fantasy football basé sur le championnat de France de Ligue 1.
                Chaque participant compose une équipe de joueurs professionnels et accumule des points en fonction
                de leurs performances réelles lors de chaque journée de championnat.
              </p>
              <p>
                Le classement est établi sur l&apos;ensemble de la saison (38 journées). Le participant
                totalisant le plus de points à l&apos;issue de la saison est déclaré champion.
              </p>
            </Section>

            {/* Composition d'équipe */}
            <Section title="Composition d&apos;équipe">
              <p>
                Chaque équipe est composée de <strong className="text-white">13 joueurs</strong> :
                11 titulaires et 2 remplaçants. La composition doit respecter le schéma suivant :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>1 gardien (GK)</li>
                <li>3 à 5 défenseurs (DEF)</li>
                <li>3 à 5 milieux (MID)</li>
                <li>1 à 3 attaquants (ATT)</li>
              </ul>
              <p>
                Seuls les <strong className="text-white">11 titulaires</strong> rapportent des points chaque journée.
                Les remplaçants ne sont pas comptabilisés sauf en cas de remplacement autorisé.
              </p>
            </Section>

            {/* Système de points */}
            <Section title="Système de points">
              <p>Les points sont calculés selon les règles suivantes :</p>

              <div className="bg-surface rounded-lg border border-white/[0.07] overflow-hidden mt-3">
                <div className="divide-y divide-white/[0.05]">
                  <PointRule label="Note de base" desc="Note L'Équipe du joueur (sur 10)" />
                  <PointRule label="Joueur non noté" desc="Forfait : 2 pts" />
                  <PointRule label="Carton rouge" desc="Note remplacée par 0" />
                  <PointRule label="But (Gardien)" desc="+10 pts par but" />
                  <PointRule label="But (Défenseur)" desc="+4 pts par but" />
                  <PointRule label="But (Milieu / Attaquant)" desc="+2 pts par but" />
                  <PointRule label="Passe décisive" desc="+1 pt par passe" />
                  <PointRule label="Pénalty arrêté (GK)" desc="+2 pts par arrêt" />
                  <PointRule label="But contre son camp (CSC)" desc="-2 pts par CSC" />
                </div>
              </div>

              <p className="mt-3">
                <strong className="text-white">Tapis vert :</strong> en cas de match reporté ou arrêté,
                les titulaires de l&apos;équipe gagnante reçoivent 5 pts, ceux de l&apos;équipe perdante 4 pts.
                Les remplaçants reçoivent 2 pts.
              </p>
            </Section>

            {/* Enchères et mercato */}
            <Section title="Enchères et mercato">
              <p>
                L&apos;effectif est constitué lors d&apos;une séance d&apos;enchères en début de saison.
                Chaque participant dispose d&apos;un budget initial identique pour enchérir sur les joueurs.
              </p>
              <p>
                Un <strong className="text-white">mercato d&apos;hiver</strong> permet de renforcer son effectif
                en cours de saison. Le budget mercato est calculé en fonction du classement :
                le 1er reçoit 10 pts de budget, puis +2 pts par rang (12, 14, 16... jusqu&apos;à 48 pour le dernier).
              </p>
            </Section>

            {/* Jokers */}
            <Section title="Jokers">
              <p>
                Chaque participant dispose de <strong className="text-white">2 jokers</strong> par saison.
                Un joker permet de remplacer un joueur de son effectif par un joueur libre (non sélectionné
                par un autre participant), sans passer par le mercato.
              </p>
              <p>
                Les jokers sont utilisables à tout moment de la saison, avant le verrouillage de la journée.
              </p>
            </Section>

            {/* Coupe Enchantée */}
            <Section title="Coupe Enchantée">
              <p>
                En parallèle du championnat, une coupe à élimination directe oppose les participants en matchs
                aller-retour. Le tirage au sort est effectué en début de saison.
              </p>
              <p>
                Le score de chaque manche correspond aux points de la journée correspondante.
                Le participant avec le score cumulé le plus élevé se qualifie pour le tour suivant.
              </p>
            </Section>

            {/* Cotisation */}
            <Section title="Cotisation">
              <p>
                Une cotisation annuelle est demandée à chaque participant pour financer les récompenses
                de fin de saison (trophée champion, prix du meilleur score journée, prix du fair-play, etc.).
              </p>
              <p>
                Le montant est fixé par vote en début de saison.
              </p>
            </Section>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.07] py-6 text-center">
          <Link href="/reglement" className="text-sm text-gold hover:underline">
            Règlement
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
