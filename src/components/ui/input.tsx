import * as React from "react";

import { cn } from "@/lib/utils";

const NO_CAPITALIZE_TYPES = new Set([
  "email",
  "password",
  "url",
  "tel",
  "number",
  "search",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
  "color",
  "file",
  "checkbox",
  "radio",
  "hidden",
  "range",
]);

function capitalizeFirst(value: string): string {
  if (!value) return value;
  // Find first non-whitespace character, uppercase it.
  const idx = value.search(/\S/);
  if (idx < 0) return value;
  const ch = value[idx];
  const upper = ch.toUpperCase();
  if (upper === ch) return value;
  return value.slice(0, idx) + upper + value.slice(idx + 1);
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onBlur, autoCapitalize, ...props }, ref) => {
    const shouldCapitalize =
      !NO_CAPITALIZE_TYPES.has((type ?? "text").toLowerCase()) &&
      (props as Record<string, unknown>)["data-no-capitalize"] == null;

    const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
      if (shouldCapitalize) {
        const el = e.currentTarget;
        const current = el.value;
        const next = capitalizeFirst(current);
        if (next !== current) {
          // Use the native setter so React picks up the change for controlled inputs.
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          )?.set;
          setter?.call(el, next);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      onBlur?.(e);
    };

    return (
      <input
        type={type}
        autoCapitalize={autoCapitalize ?? (shouldCapitalize ? "sentences" : "off")}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
