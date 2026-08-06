import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  FileCheck2,
  Inbox,
  MessageSquare,
  RefreshCw,
  Settings2,
  ArrowLeftRight,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  listStaffNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Saffron Planning Studio" },
      { name: "description", content: "Comments, status changes and studio activity." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin={false}>
      <AdminNotificationsPage />
    </AuthGate>
  ),
});

interface NotificationRow {
  id: string;
  kind: string;
  project_id: string | null;
  project_name: string | null;
  vendor_id: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, any>;
  read_by: Record<string, string> | null;
  created_at: string;
}

// ── Taxonomy ──────────────────────────────────────────────────────────────────

type Category =
  | "vendor_comment"
  | "client_status_change"
  | "quote_action"
  | "rsvp"
  | "payment"
  | "inquiry"
  | "system";

/** DB `kind` is free text — map it, and never drop a row we don't recognise. */
const KIND_TO_CATEGORY: Record<string, Category> = {
  comment: "vendor_comment",
  status_change: "client_status_change",
  quote_action: "quote_action",
  quote: "quote_action",
  rsvp: "rsvp",
  payment: "payment",
  inquiry: "inquiry",
  lead: "inquiry",
  system: "system",
};
const categoryOf = (kind: string): Category => KIND_TO_CATEGORY[kind] ?? "system";

const CATEGORY_META: Record<
  Category,
  { label: string; plural: string; icon: React.ReactNode }
> = {
  vendor_comment: { label: "vendor comment", plural: "vendor comments", icon: <MessageSquare className="h-4 w-4" /> },
  client_status_change: { label: "client status change", plural: "client status changes", icon: <ArrowLeftRight className="h-4 w-4" /> },
  quote_action: { label: "quote action", plural: "quote actions", icon: <FileCheck2 className="h-4 w-4" /> },
  rsvp: { label: "rsvp", plural: "RSVP updates", icon: <Users className="h-4 w-4" /> },
  payment: { label: "payment", plural: "payment updates", icon: <Wallet className="h-4 w-4" /> },
  inquiry: { label: "inquiry", plural: "inquiries", icon: <Inbox className="h-4 w-4" /> },
  system: { label: "system", plural: "system updates", icon: <Settings2 className="h-4 w-4" /> },
};
const CATEGORY_ORDER: Category[] = [
  "vendor_comment", "client_status_change", "quote_action",
  "rsvp", "payment", "inquiry", "system",
];

// ── Clubbing ──────────────────────────────────────────────────────────────────

/** Same category + same project + same day collapses into one summary row. */
interface FeedEntry {
  key: string;
  category: Category;
  items: NotificationRow[];
  latest: string;
  projectId: string | null;
  projectName: string | null;
}

function clubEntries(rows: NotificationRow[]): FeedEntry[] {
  const buckets = new Map<string, FeedEntry>();
  for (const row of rows) {
    const category = categoryOf(row.kind);
    const day = row.created_at.slice(0, 10);
    const key = `${category}::${row.project_id ?? "none"}::${day}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(row);
      if (row.created_at > existing.latest) existing.latest = row.created_at;
    } else {
      buckets.set(key, {
        key,
        category,
        items: [row],
        latest: row.created_at,
        projectId: row.project_id,
        projectName: row.project_name,
      });
    }
  }
  return [...buckets.values()].sort((a, b) => b.latest.localeCompare(a.latest));
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "less than a minute ago";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function AdminNotificationsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const initialised = useRef(false);

  const refresh = async () => {
    try {
      const rows = (await listStaffNotifications({ data: { limit: 200 } })) as NotificationRow[];
      setItems(rows);
    } catch {
      // silent — the page still renders whatever is cached
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    refresh().then(() => {
      initialised.current = true;
    });
    // Unique channel name per mount — a shared name breaks under React strict
    // mode's double-mount (second .on() after subscribe() throws).
    const ch = supabase
      .channel(`staff_notifications_page_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_notifications" },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev]));
          if (initialised.current) toast.info(row.title);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const isUnread = (r: NotificationRow) => (userId ? !r.read_by?.[userId] : false);
  const unreadCount = useMemo(() => items.filter(isUnread).length, [items, userId]);

  /** Counts per category drive the chips — a category with no data is hidden. */
  const counts = useMemo(() => {
    const c = new Map<Category, number>();
    for (const r of items) c.set(categoryOf(r.kind), (c.get(categoryOf(r.kind)) ?? 0) + 1);
    return c;
  }, [items]);

  const entries = useMemo(() => {
    let rows = items;
    if (category !== "all") rows = rows.filter((r) => categoryOf(r.kind) === category);
    if (unreadOnly) rows = rows.filter(isUnread);
    return clubEntries(rows);
  }, [items, category, unreadOnly, userId]);

  const markOne = async (id: string) => {
    if (!userId) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, read_by: { ...(it.read_by ?? {}), [userId]: new Date().toISOString() } }
          : it,
      ),
    );
    try {
      await markNotificationRead({ data: { id } });
    } catch {}
  };

  const markGroup = async (entry: FeedEntry) => {
    for (const it of entry.items) if (isUnread(it)) await markOne(it.id);
  };

  const markAll = async () => {
    if (!userId) return;
    const stamp = new Date().toISOString();
    setItems((prev) => prev.map((it) => ({ ...it, read_by: { ...(it.read_by ?? {}), [userId]: stamp } })));
    try {
      await markAllNotificationsRead({});
      toast.success("All caught up");
    } catch {}
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      {/* Secondary toolbar */}
      <div className="h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="hidden text-sm text-[var(--charcoal)]/55 sm:inline">
            Comments, status changes and studio activity.
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                unreadOnly
                  ? "border-[var(--terracotta)] bg-[var(--terracotta)] text-[var(--cream)]"
                  : "border-[var(--border)] bg-white text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
              }`}
            >
              Unread only
            </button>
            <button
              onClick={() => refresh()}
              aria-label="Refresh"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--charcoal)]/75 transition hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={markAll}
              disabled={unreadCount === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-2.5 py-1.5 text-sm font-medium text-[var(--cream)] shadow-sm transition-all hover:bg-[var(--terracotta)]/90 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:px-3.5"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 hidden flex-wrap items-center justify-between gap-3 sm:mb-5 sm:flex">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Activity feed
          </h1>
        </div>


        {/* Category chips — only categories with data are shown */}
        <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border)] bg-white p-1">
          <Chip active={category === "all"} onClick={() => setCategory("all")} label="all" count={items.length} />
          {CATEGORY_ORDER.filter((c) => (counts.get(c) ?? 0) > 0).map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={CATEGORY_META[c].label}
              count={counts.get(c) ?? 0}
            />
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-xl bg-[var(--cream-deep)]/50" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white py-16 text-center shadow-sm">
            <Bell className="mx-auto h-8 w-8 text-[var(--charcoal)]/20" />
            <p className="mt-3 font-display text-lg text-[var(--charcoal)]">
              {unreadOnly ? "All caught up" : "Nothing here yet"}
            </p>
            <p className="mt-1 text-xs text-[var(--charcoal)]/50">
              {unreadOnly
                ? "Every notification in this view has been read."
                : "Activity will appear here as it happens."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <FeedRow
                key={entry.key}
                entry={entry}
                isUnread={isUnread}
                expanded={expanded.has(entry.key)}
                onToggle={() => toggle(entry.key)}
                onMarkOne={markOne}
                onMarkGroup={() => markGroup(entry)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium capitalize transition ${
        active
          ? "border-[var(--terracotta)] bg-[var(--terracotta)] text-[var(--cream)] shadow-sm"
          : "border-[var(--border)] bg-white text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
      }`}
    >
      {icon && <span className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
      <span className="truncate">{label}</span>
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
          active
            ? "bg-[var(--cream)]/25 text-[var(--cream)]"
            : "bg-[var(--cream-deep)] text-[var(--charcoal)]/60"
        }`}
      >
        {count}
      </span>
    </button>
  );
}


function FeedRow({
  entry,
  isUnread,
  expanded,
  onToggle,
  onMarkOne,
  onMarkGroup,
}: {
  entry: FeedEntry;
  isUnread: (r: NotificationRow) => boolean;
  expanded: boolean;
  onToggle: () => void;
  onMarkOne: (id: string) => void;
  onMarkGroup: () => void;
}) {
  const meta = CATEGORY_META[entry.category];
  const clubbed = entry.items.length > 1;
  const groupUnread = entry.items.filter(isUnread).length;
  const href = entry.projectId ? `/admin/projects/${entry.projectId}` : "/admin";

  const iconBadge = (
    <span
      className={`mt-0.5 shrink-0 rounded-full p-2 sm:p-2.5 ${
        groupUnread > 0
          ? "bg-[var(--terracotta-soft)] text-[var(--terracotta)]"
          : "bg-[var(--cream-deep)]/60 text-[var(--charcoal)]/40"
      }`}
    >
      {meta.icon}
    </span>
  );

  // ── Single item: a plain link row ──
  if (!clubbed) {
    const it = entry.items[0];
    const unread = isUnread(it);
    return (
      <div className={`overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm ${unread ? "border-l-2 border-l-[var(--terracotta)]" : ""}`}>
        <Link
          to={href}
          onClick={() => onMarkOne(it.id)}
          className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-3 py-3 transition hover:bg-[var(--cream)]/50 sm:px-4"
        >
          {iconBadge}
          <div className="min-w-0">
            <div className={`break-words text-sm leading-snug ${unread ? "font-semibold text-[var(--charcoal)]" : "text-[var(--charcoal)]/70"}`}>
              {it.title}
            </div>
            {it.body && (
              <div className="mt-0.5 line-clamp-2 break-words text-xs text-[var(--charcoal)]/55">{it.body}</div>
            )}
            <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--charcoal)]/40">
              {timeAgo(it.created_at)}
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // ── Clubbed: summary row that expands to the individual items ──
  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm ${groupUnread > 0 ? "border-l-2 border-l-[var(--terracotta)]" : ""}`}>
      <button
        onClick={onToggle}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 text-left transition hover:bg-[var(--cream)]/50 sm:px-4"
      >
        {iconBadge}
        <div className="min-w-0">
          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug ${groupUnread > 0 ? "font-semibold text-[var(--charcoal)]" : "text-[var(--charcoal)]/70"}`}>
            <span className="break-words">
              {entry.items.length} {meta.plural}
            </span>
            {groupUnread > 0 && (
              <span className="rounded-full bg-[var(--terracotta)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--cream)]">
                {groupUnread} new
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--charcoal)]/55">
            {entry.projectName ?? entry.items[0].title}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--charcoal)]/40">
            {timeAgo(entry.latest)}
          </div>
        </div>
        <ChevronDown
          className={`mt-2 h-4 w-4 shrink-0 text-[var(--charcoal)]/40 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>


      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--cream)]/30">
          {entry.items.map((it) => {
            const unread = isUnread(it);
            return (
              <Link
                key={it.id}
                to={href}
                onClick={() => onMarkOne(it.id)}
                className="flex items-start gap-2 border-b border-[var(--border)]/50 px-3 py-2.5 pl-11 transition last:border-b-0 hover:bg-white sm:gap-3 sm:px-4 sm:pl-14"
              >
                <div className="min-w-0 flex-1">
                  <div className={`break-words text-[13px] leading-snug ${unread ? "font-medium text-[var(--charcoal)]" : "text-[var(--charcoal)]/65"}`}>
                    {it.title}
                  </div>
                  {it.body && (
                    <div className="mt-0.5 line-clamp-2 break-words text-[11px] text-[var(--charcoal)]/50">{it.body}</div>
                  )}
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--charcoal)]/35">
                    {timeAgo(it.created_at)}
                  </div>
                </div>
                {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--terracotta)]" />}
              </Link>
            );
          })}
          {groupUnread > 0 && (
            <button
              onClick={onMarkGroup}
              className="w-full border-t border-[var(--border)]/50 px-4 py-2 text-[11px] font-medium text-[var(--terracotta)] transition hover:bg-white"
            >
              Mark these {groupUnread} as read
            </button>
          )}
        </div>
      )}
    </div>
  );
}
