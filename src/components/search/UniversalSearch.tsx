import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Users,
  Heart,
  ReceiptText,
  CheckSquare,
  MessageSquare,
  CalendarDays,
  Bell,
  CornerDownLeft,
  X,
} from "lucide-react";
import { universalSearch } from "@/lib/universal-search.functions";
import {
  closeUniversalSearch,
  openUniversalSearch,
  pushRecentSearch,
  readRecentSearches,
  useUniversalSearchOpen,
} from "@/lib/universal-search-store";
import { useAuth } from "@/lib/auth";

type Hit = Awaited<ReturnType<typeof universalSearch>>[number];

const KIND_META: Record<string, { label: string; icon: any }> = {
  vendor: { label: "Vendors", icon: Users },
  project: { label: "Projects", icon: Heart },
  quote: { label: "Quotes", icon: ReceiptText },
  task: { label: "Tasks", icon: CheckSquare },
  comment: { label: "Comments", icon: MessageSquare },
  calendar: { label: "Calendar", icon: CalendarDays },
  alert: { label: "Alerts", icon: Bell },
};

const ORDER = ["vendor", "project", "quote", "task", "comment", "calendar", "alert"];

/** Header trigger — icon only, matches the other header affordances. */
export function UniversalSearchButton({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={openUniversalSearch}
      title="Search everything (⌘K)"
      aria-label="Search everything"
      className={
        className ||
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-white text-[var(--charcoal)]/82 transition-colors hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
      }
    >
      <Search className="h-4 w-4" />
    </button>
  );
}

export function UniversalSearchDialog() {
  const isOpen = useUniversalSearchOpen();
  const { session, initialized } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  // Global shortcut: ⌘K / Ctrl+K anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openUniversalSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setRecent(readRecentSearches());
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => setCursor(0), [debounced]);

  const enabled = isOpen && initialized && !!session?.access_token && debounced.length >= 2;
  const { data, isFetching } = useQuery({
    queryKey: ["universal-search", debounced],
    queryFn: () => universalSearch({ data: { q: debounced } }),
    enabled,
    staleTime: 30_000,
  });

  const hits: Hit[] = useMemo(() => {
    const rows = (data ?? []) as Hit[];
    return [...rows].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const h of hits) {
      const arr = map.get(h.type) ?? [];
      arr.push(h);
      map.set(h.type, arr);
    }
    return [...map.entries()];
  }, [hits]);

  const go = (hit: Hit) => {
    pushRecentSearch(debounced);
    closeUniversalSearch();
    setTerm("");
    navigate({ to: hit.to, search: (hit.search ?? {}) as never } as never);
  };

  if (!isOpen) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeUniversalSearch();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      const hit = hits[cursor];
      if (hit) {
        e.preventDefault();
        go(hit);
      }
    }
  };

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[var(--charcoal)]/35 px-3 pt-[12vh] backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeUniversalSearch();
      }}
    >
      <div
        role="dialog"
        aria-label="Universal search"
        onKeyDown={onKeyDown}
        className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-white/50 bg-[var(--cream)]/85 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border)]/70 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--terracotta)]" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search vendors, projects, quotes, tasks, comments, alerts…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--charcoal)] outline-none placeholder:text-[var(--charcoal)]/55"
          />
          {isFetching && (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--terracotta)] border-t-transparent" />
          )}
          <button
            onClick={closeUniversalSearch}
            aria-label="Close search"
            className="shrink-0 rounded-md p-1 text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-2 py-2">
          {debounced.length < 2 && (
            <div className="px-3 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/60">
                {recent.length ? "Recent searches" : "Start typing"}
              </div>
              {recent.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => setTerm(r)}
                      className="rounded-full border border-[var(--border)] bg-white/70 px-2.5 py-1 text-xs text-[var(--charcoal)]/82 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--charcoal)]/70">
                  Search across vendors, projects, quotes, tasks, comments, calendar deadlines and
                  alerts. Press <kbd className="rounded bg-white/70 px-1">Esc</kbd> to close.
                </p>
              )}
            </div>
          )}

          {debounced.length >= 2 && !isFetching && hits.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-[var(--charcoal)]/70">
              No matches for “{debounced}”.
            </div>
          )}

          {groups.map(([kind, rows]) => {
            const meta = KIND_META[kind] ?? { label: kind, icon: Search };
            const Icon = meta.icon;
            return (
              <div key={kind} className="mb-1">
                <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--charcoal)]/60">
                  <Icon className="h-3 w-3" /> {meta.label}
                  <span className="text-[var(--charcoal)]/45">{rows.length}</span>
                </div>
                {rows.map((hit) => {
                  flatIndex += 1;
                  const active = flatIndex === cursor;
                  return (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      onMouseEnter={() => setCursor(hits.indexOf(hit))}
                      onClick={() => go(hit)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        active ? "bg-[var(--terracotta)]/12" : "hover:bg-white/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--charcoal)]">
                          {hit.title}
                        </div>
                        {(hit.subtitle || hit.context) && (
                          <div className="truncate text-xs text-[var(--charcoal)]/70">
                            {[hit.context, hit.subtitle].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                      {active && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)]/70 px-4 py-2 text-[10px] text-[var(--charcoal)]/60">
          <span>↑↓ navigate · ↵ open · Esc close</span>
          <span>⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
}
