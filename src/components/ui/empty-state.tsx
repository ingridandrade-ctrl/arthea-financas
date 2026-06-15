"use client";

import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className = "" }: Props) {
  return (
    <div
      className={`bg-card border border-border rounded-xl p-12 text-center flex flex-col items-center gap-3 ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
