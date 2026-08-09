import { redirect } from "next/navigation";

// /ligue/<slug> sans sous-page rendait un 404 Next brut (trouvé en recette P2).
// La page d'entrée naturelle d'une ligue est son classement.
export default function LiguePage({ params }: { params: { slug: string } }) {
  redirect(`/ligue/${params.slug}/classement`);
}
