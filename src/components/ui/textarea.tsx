import * as React from "react";

import { cn } from "@/lib/utils";

function capitalizeFirst(value: string): string {
  if (!value) return value;
  const idx = value.search(/\S/);
  if (idx < 0) return value;
  const ch = value[idx];
  const upper = ch.toUpperCase();
  if (upper === ch) return value;
  return value.slice(0, idx) + upper + value.slice(idx + 1);
}

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, onBlur, autoCapitalize, ...props }, ref) => {
    const shouldCapitalize =
      (props as Record<string, unknown>)["data-no-capitalize"] == null;

    const handleBlur: React.FocusEventHandler<HTMLTextAreaElement> = (e) => {
      if (shouldCapitalize) {
        const el = e.currentTarget;
        const current = el.value;
        const next = capitalizeFirst(current);
        if (next !== current) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          setter?.call(el, next);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      onBlur?.(e);
    };

    return (
      <textarea
        autoCapitalize={autoCapitalize ?? "sentences"}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
