import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isUserAdmin } from "@/lib/admin-auth";
import MarkdownAdminDoc from "@/components/admin/MarkdownAdminDoc";
import { ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

// Règlement formel des enchères, rendu depuis docs/regles-encheres.md (source
// de vérité, déployée avec le code). Réservé aux admins. La page « Aide Mercato »
// (docs/encheres-admin.md) explique le mécanisme ; celle-ci porte les règles et
// le journal des décisions dans leur granularité.
export default async function ReglesEncheresPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { userId?: number } | undefined)?.userId;
  if (!userId || !(await isUserAdmin(userId))) redirect("/login");

  const full = await fs.readFile(path.join(process.cwd(), "docs", "regles-encheres.md"), "utf-8");
  // Le journal des décisions (§7) reste CONSIGNÉ dans le fichier source (repo,
  // non public) mais n'est PAS affiché sur cette page (décision 2026-08-12) :
  // il contient des attributions nominatives à garder hors de la vue admin.
  const md = full.split(/\n##\s+7\.\s/)[0].trimEnd() + "\n";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-gold" />
          Règlement des enchères
        </h1>
        <p className="text-sm text-muted">
          Règlement formel et journal des décisions, source de vérité mise à jour avec le site à chaque déploiement.
        </p>
      </div>

      <MarkdownAdminDoc markdown={md} />
    </div>
  );
}
