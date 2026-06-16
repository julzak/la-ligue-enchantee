import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Rendu markdown partagé des docs d'admin (kick-off, aide enchères...).
// Le <h1> du fichier .md est masqué : le titre de page est porté par l'en-tête.
export default function MarkdownAdminDoc({ markdown }: { markdown: string }) {
  return (
    <article className="space-y-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: () => null,
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
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
