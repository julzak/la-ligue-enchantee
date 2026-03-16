"use client";

import { Flame, Snowflake } from "lucide-react";
import type { FormIndicator } from "@/lib/types";

export function FormBadge({ form }: { form: FormIndicator }) {
  if (!form) return null;

  if (form === "hot") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-400" title="En feu">
        <Flame className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-400" title="En meche courte">
      <Snowflake className="w-3 h-3" />
    </span>
  );
}
