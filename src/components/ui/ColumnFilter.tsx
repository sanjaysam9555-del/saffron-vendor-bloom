import { Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ColumnFilterOption {
  value: string;
  label: string;
  dot?: string;
}

interface Props {
  options: ColumnFilterOption[];
  selected: string[];
  onChange: (vals: string[]) => void;
  label?: string;
  align?: "left" | "right";
}

/**
 * Small per-column header filter — icon button + checkbox popover.
 * Multi-select; empty `selected` means "no filter".
 */
export function ColumnFilter({ options, selected, onChange, label, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };
  const active = selected.length > 0;
  return (
    <span ref={ref} className="relative inline-block normal-case">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={label ? `Filter ${label}` : "Filter"}
        aria-label={label ? `Filter ${label}` : "Filter"}
        className={`inline-flex items-center rounded p-0.5 transition hover:text-[var(--terracotta)] ${
          // This button lives inside dark charcoal table headers everywhere
          // it's used — `--charcoal` text at 40% opacity was dark-on-dark and
          // nearly invisible until hover. `--cream` at reduced opacity is the
          // same treatment the header labels themselves use.
          active ? "text-[var(--terracotta)]" : "text-[var(--cream)]/50"
        }`}
      >
        <Filter className={`h-3 w-3 ${active ? "fill-current" : ""}`} />
        {active && (
          <span className="ml-0.5 rounded-full bg-[var(--terracotta)] px-1 text-[9px] font-bold text-[var(--cream)]">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-1 w-56 rounded-md border border-[var(--border)] bg-white p-2 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--charcoal)]/70">
            <span>{label ?? "Filter"}</span>
            {active && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-auto">
            {options.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-[var(--charcoal)]/70">No options</div>
            ) : (
              options.map((o) => {
                const checked = selected.includes(o.value);
                return (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs font-normal text-[var(--charcoal)] hover:bg-[var(--cream)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                      className="h-3.5 w-3.5 accent-[var(--terracotta)]"
                    />
                    {o.dot && (
                      <span
                        className="inline-block h-2 w-2 flex-none rounded-full"
                        style={{ background: o.dot }}
                      />
                    )}
                    <span className="truncate">{o.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </span>
  );
}
