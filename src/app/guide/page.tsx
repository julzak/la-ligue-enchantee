import { Navbar } from "@/components/layout/Navbar";

export default function GuidePage() {
  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
          <article className="prose prose-invert prose-sm max-w-none [&_h1]:font-serif [&_h1]:text-gold [&_h1]:text-2xl [&_h1]:mb-6 [&_h2]:font-serif [&_h2]:text-gold [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-gold/20 [&_h2]:pb-2 [&_h3]:text-white [&_h3]:text-base [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:text-white/70 [&_p]:text-sm [&_li]:text-white/70 [&_li]:text-sm [&_strong]:text-white [&_table]:text-sm [&_th]:text-gold [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_td]:text-white/70 [&_hr]:border-white/10">

            <h1>Guide du nouveau site</h1>

            <p>
              Le nouveau site remplace l&apos;ancien ligueenchantee.com. Toutes les données sont les mêmes — seule l&apos;interface change.
            </p>

            <h2>Se connecter</h2>
            <p>Même identifiant (pseudo) et mot de passe qu&apos;avant.</p>

            <h2>Résultats et classements</h2>
            <ul>
              <li><strong>Page d&apos;accueil</strong> : journée en cours, meilleurs/pires joueurs, résultats L1, classement interligue</li>
              <li><strong>Résultats</strong> : classement de la journée, leader, progressions, résumé IA</li>
              <li><strong>Général</strong> : classement cumulé de la saison</li>
              <li><strong>Stats</strong> : classement joueurs L1 filtrable par poste</li>
            </ul>

            <h2>Mon équipe</h2>
            <ul>
              <li>Voir votre effectif de 13 joueurs avec photos et scores</li>
              <li>Choisir vos <strong>11 titulaires</strong> en cliquant sur les joueurs</li>
              <li>Contraintes : 1 GK, 3-5 DEF, 3-5 MIL, 1-3 ATT</li>
              <li><strong>Valider avant la deadline</strong> affichée en haut de page</li>
            </ul>

            <h2>Coupe Enchantée</h2>
            <p>Bracket complet accessible depuis l&apos;accueil. Règle du Petit Poucet : bonus pour l&apos;équipe moins bien classée.</p>

            <h2>Mercato</h2>
            <p>Quand le mercato est ouvert, un bandeau apparaît sur toutes les pages. Cliquez dessus pour enchérir sur les joueurs libres.</p>

            <h2>Ce qui a changé</h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr><th>Fonctionnalité</th><th>Avant</th><th>Maintenant</th></tr>
                </thead>
                <tbody>
                  <tr><td>Interface</td><td>PHP/HTML</td><td>Design moderne, responsive</td></tr>
                  <tr><td>Photos joueurs</td><td>Aucune</td><td>99% des joueurs</td></tr>
                  <tr><td>Mon équipe</td><td>Via forum</td><td>Page dédiée</td></tr>
                  <tr><td>Coupe</td><td>Excel</td><td>Bracket interactif</td></tr>
                  <tr><td>Enchères</td><td>Excel/email</td><td>Module en ligne</td></tr>
                  <tr><td>Topo IA</td><td>N&apos;existait pas</td><td>Résumé auto chaque journée</td></tr>
                  <tr><td>Classement interligue</td><td>Limité</td><td>Page complète</td></tr>
                </tbody>
              </table>
            </div>

          </article>
        </div>
      </div>
    </>
  );
}
