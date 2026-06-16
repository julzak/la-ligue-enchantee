import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isUserAdmin } from "@/lib/admin-auth";
import MarkdownAdminDoc from "@/components/admin/MarkdownAdminDoc";
import { Gavel } from "lucide-react";

export const dynamic = "force-dynamic";

// Explication du fonctionnement des enchères, rendue depuis docs/encheres-admin.md
// (source unique, déployée avec le code). Réservé aux admins.
export default async function AideEncheresPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { userId?: number } | undefined)?.userId;
  if (!userId || !(await isUserAdmin(userId))) redirect("/login");

  const md = await fs.readFile(path.join(process.cwd(), "docs", "encheres-admin.md"), "utf-8");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Gavel className="w-6 h-6 text-gold" />
          Comment fonctionnent les enchères
        </h1>
        <p className="text-sm text-muted">
          Le mécanisme expliqué, mis à jour avec le site à chaque déploiement.
        </p>
      </div>

      <MarkdownAdminDoc markdown={md} />
    </div>
  );
}
