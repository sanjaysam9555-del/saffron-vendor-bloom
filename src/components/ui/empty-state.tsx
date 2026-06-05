import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Smaller padding for inline (in-card) usage. */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--champagne)] bg-white text-center animate-fade-up",
        compact ? "py-6 px-4" : "py-14 px-6",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 text-[var(--terracotta)] animate-scale-in [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </div>
      )}
      <h3
        className={cn(
          "font-display font-semibold text-[var(--charcoal)]",
          compact ? "text-base" : "text-2xl",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "mt-1.5 max-w-md text-[var(--charcoal)]/60",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
