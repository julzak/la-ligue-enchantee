import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isUserAdmin } from "@/lib/admin-auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Rocket } from "lucide-react";

export const dynamic = "force-dynamic";

// Runbook "kick-off nouvelle saison" rendu depuis docs/kickoff-nouvelle-saison.md.
// Source de vérité UNIQUE = le fichier markdown du repo (déployé avec le code) :
// cette page ne fait que l'afficher, aucune duplication de contenu.
export default async function KickoffGuidePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { userId?: number } | undefined)?.userId;
  if (!userId || !(await isUserAdmin(userId))) redirect("/login");

  const md = await fs.readFile(
    path.join(process.cwd(), "docs", "kickoff-nouvelle-saison.md"),
    "utf-8"
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-gold" />
          Kick-off nouvelle saison
        </h1>
        <p className="text-sm text-muted">
          Le mode d&apos;emploi officiel, mis à jour avec le site à chaque déploiement.
        </p>
      </div>

      <article className="space-y-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: () => null, // le titre du .md est déjà porté par l'en-tête de page
            h2: ({ children }) => (
              <h2 className="font-serif text-lg text-gold mt-8 mb-3 border-b border-border pb-2">{children}</h2>
            ),
            h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-5 mb-2">{children}</h3>,
            p: ({ children }) => <p className="text-sm text-foreground/90 leading-relaxed my-2">{children}</p>,
            ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-5 my-2 text-sm text-foreground/90">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5 my-2 text-sm text-foreground/90">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            em: ({ children }) => <em className="text-muted">{children}</em>,
            code: ({ children }) => (
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.85em] text-gold">{children}</code>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-gold/60 bg-gold/[0.06] rounded-r px-4 py-2 my-3 [&_p]:my-1">
                {children}
              </blockquote>
            ),
            hr: () => <hr className="border-border my-6" />,
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="w-full text-sm border-collapse">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="text-left text-muted">{children}</thead>,
            th: ({ children }) => (
              <th className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wider">{children}</th>
            ),
            td: ({ children }) => (
              <td className="border-b border-border/50 px-3 py-2 align-top text-foreground/90">{children}</td>
            ),
            a: ({ children, href }) => (
              <a href={href} className="text-gold underline-offset-2 hover:underline">{children}</a>
            ),
          }}
        >
          {md}
        </ReactMarkdown>
      </article>
    </div>
  );
}
