"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-12 h-12 text-muted mb-4" />
      <h3 className="text-lg font-medium text-white/60 mb-1">{title}</h3>
      {description && <p className="text-sm text-muted">{description}</p>}
    </div>
  );
}
