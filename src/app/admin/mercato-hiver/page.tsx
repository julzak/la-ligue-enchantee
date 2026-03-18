"use client";

import { Snowflake } from "lucide-react";

export default function MercatoHiverPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-2xl text-white mb-1 flex items-center gap-2">
          <Snowflake className="w-6 h-6 text-blue-400" />
          Mercato d&apos;hiver
        </h1>
        <p className="text-sm text-muted">Renforcement des effectifs en milieu de saison</p>
      </div>

      <div className="bg-surface rounded-lg border border-white/[0.07] p-8 text-center">
        <Snowflake className="w-12 h-12 text-blue-400/30 mx-auto mb-4" />
        <p className="text-muted">Module en cours de développement</p>
        <p className="text-xs text-white/20 mt-2">Les règles du mercato d&apos;hiver seront intégrées prochainement</p>
      </div>
    </div>
  );
}
