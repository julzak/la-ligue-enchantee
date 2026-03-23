import { Navbar } from "@/components/layout/Navbar";

export default function GuidePage() {
  return (
    <>
      <Navbar />
      <div className="pt-[52px]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
          <article className="prose prose-invert prose-sm max-w-none [&_h1]:font-serif [&_h1]:text-gold [&_h1]:text-2xl [&_h1]:mb-6 [&_h2]:font-serif [&_h2]:text-gold [&_h2]:text-lg [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-gold/20 [&_h2]:pb-2 [&_h3]:text-white [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-white/70 [&_p]:text-sm [&_li]:text-white/70 [&_li]:text-sm [&_strong]:text-white [&_table]:text-sm [&_th]:text-gold [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_td]:text-white/70 [&_hr]:border-white/10">

            <h1>Guide du nouveau site</h1>

            <h2>Vue d&apos;ensemble</h2>
            <p>
              Le nouveau site remplace l&apos;ancien ligueenchantee.com. Toutes les données (joueurs, équipes, scores, classements)
              sont les mêmes — seule l&apos;interface change.
            </p>
            <p><strong>3 ligues, 54 participants :</strong> Ligue 1 (Baudens League), Ligue 2, National 1 — 18 participants chacune.</p>

            <hr />

            <h2>Pour les participants</h2>

            <h3>Se connecter</h3>
            <p>Aller sur le site → <strong>Se connecter</strong> avec votre identifiant habituel (pseudo) et mot de passe.</p>

            <h3>Consulter les résultats</h3>
            <ul>
              <li><strong>Page d&apos;accueil</strong> : résumé de la journée en cours, meilleurs/pires joueurs, résultats L1, classement interligue</li>
              <li><strong>Résultats</strong> (onglet dans votre ligue) : classement de la journée, leader, progressions/chutes, résumé IA &quot;Lia&quot;</li>
              <li><strong>Général</strong> : classement cumulé de la saison</li>
              <li><strong>Stats</strong> : classement des joueurs L1 par poste (G/D/M/A) et nombre (10/20/50/100)</li>
            </ul>

            <h3>Mon équipe</h3>
            <ul>
              <li><strong>Mon équipe</strong> (lien en haut) : voir votre effectif de 13 joueurs</li>
              <li>Choisir vos <strong>11 titulaires</strong> parmi vos 13 en cliquant sur les joueurs</li>
              <li>Contraintes : 1 GK, 3-5 DEF, 3-5 MIL, 1-3 ATT</li>
              <li><strong>Valider avant la deadline</strong> (affichée en haut de page)</li>
              <li>Si pas validé à temps : la compo précédente est reconduite</li>
            </ul>

            <h3>Coupe Enchantée</h3>
            <ul>
              <li>Bracket complet : préliminaire → seizièmes → huitièmes → quarts → demis → finale</li>
              <li>Règle du Petit Poucet : bonus pour l&apos;équipe moins bien classée</li>
            </ul>

            <h3>Enchères (quand le mercato est ouvert)</h3>
            <ul>
              <li>Un bandeau doré &quot;Mercato en cours&quot; apparaît sur toutes les pages</li>
              <li>Chercher un joueur libre, fixer votre mise, enchérir</li>
              <li>Budget été : 130 points par participant, enchères aveugles</li>
            </ul>

            <hr />

            <h2>Pour les admins</h2>

            <h3>Saisie des notes (après chaque journée)</h3>
            <ol>
              <li>Aller sur <strong>/admin/notes</strong></li>
              <li>Sélectionner la journée</li>
              <li>Pour chaque joueur ayant joué, saisir :
                <ul>
                  <li><strong>Note</strong> : la note L&apos;Équipe (1-10)</li>
                  <li><strong>But</strong> : nombre de buts marqués</li>
                  <li><strong>Pas</strong> : nombre de passes décisives</li>
                  <li><strong>CSC</strong> : buts contre son camp (-2 pts chacun)</li>
                  <li><strong>🟥</strong> : cocher si carton rouge (note → 0, bonus conservés)</li>
                  <li><strong>Pen</strong> : penalties arrêtés (gardiens uniquement, +2 pts)</li>
                </ul>
              </li>
              <li><strong>Sauvegarder</strong> (brouillon) puis <strong>Publier</strong> → recalcule les classements</li>
            </ol>

            <h3>Scoring automatique</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr><th>Élément</th><th>Points</th></tr>
                </thead>
                <tbody>
                  <tr><td>Note L&apos;Équipe</td><td>1-10</td></tr>
                  <tr><td>But (ATT / MIL)</td><td>+2 /but</td></tr>
                  <tr><td>But (DEF)</td><td>+4 /but</td></tr>
                  <tr><td>But (GK)</td><td>+10 /but</td></tr>
                  <tr><td>Passe décisive</td><td>+1 /passe</td></tr>
                  <tr><td>CSC</td><td>-2 /csc</td></tr>
                  <tr><td>Carton rouge</td><td>Note → 0 (bonus conservés)</td></tr>
                  <tr><td>Penalty arrêté (GK)</td><td>+2 /pen</td></tr>
                  <tr><td>Non noté / forfait</td><td>2 pts</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Exceptions manuelles</h3>
            <ul>
              <li><strong>Penalty raté</strong> : -1 pt → ajuster la note du joueur</li>
              <li><strong>Carton rouge annulé</strong> : on garde la note à 0</li>
              <li><strong>Tapis vert</strong> : 5 pts (gagnant) / 4 pts (perdant) par joueur</li>
            </ul>

            <hr />

            <h2>Ce qui a changé</h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr><th>Fonctionnalité</th><th>Avant</th><th>Maintenant</th></tr>
                </thead>
                <tbody>
                  <tr><td>Interface</td><td>PHP/HTML basique</td><td>Design moderne, responsive</td></tr>
                  <tr><td>Photos joueurs</td><td>Aucune</td><td>99% des joueurs actifs</td></tr>
                  <tr><td>Classement interligue</td><td>Limité</td><td>Page complète</td></tr>
                  <tr><td>Saisie des notes</td><td>Formulaire basique</td><td>Par match, logos clubs</td></tr>
                  <tr><td>Bonus buts</td><td>+2 pour tous</td><td>+2 ATT/MIL, +4 DEF, +10 GK</td></tr>
                  <tr><td>Carton rouge / CSC</td><td>Manuel</td><td>Cases dédiées</td></tr>
                  <tr><td>Coupe</td><td>Excel</td><td>Bracket interactif</td></tr>
                  <tr><td>Topo IA</td><td>N&apos;existait pas</td><td>Résumé auto par Lia</td></tr>
                  <tr><td>Mon équipe</td><td>Via forum</td><td>Page dédiée</td></tr>
                  <tr><td>Jokers</td><td>Forum/email</td><td>Interface admin</td></tr>
                  <tr><td>Enchères</td><td>Excel/email</td><td>Module en ligne</td></tr>
                  <tr><td>Paiements</td><td>PayPal manuel</td><td>Suivi intégré</td></tr>
                </tbody>
              </table>
            </div>

          </article>
        </div>
      </div>
    </>
  );
}
