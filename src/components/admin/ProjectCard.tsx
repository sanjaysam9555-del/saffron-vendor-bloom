import { Link } from "@tanstack/react-router";
import { Calendar, ArrowRight, Sparkles, Users, Archive, ArchiveRestore, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { useRevealOnScroll } from "@/hooks/use-reveal-on-scroll";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
import { formatINRShort } from "@/lib/quote-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ProjectCardData {
  id: string;
  bride_name: string;
  groom_name: string;
  wedding_date: string;
  archived_at: string | null;
  notes: string | null;
  updated_at: string;
  vendor_count: number;
  client_count: number;
  saffron_pick_count?: number;
  status_counts?: Record<string, number>;
  quotes_summary?: {
    total_quotes: number;
    vendors_with_quotes: number;
    closed_count: number;
    finalised_vendors: number;
    closed_total_amount: number;
  };
}

interface Props {
  project: ProjectCardData;
  canDelete: boolean;
  onArchiveToggle: (id: string, next: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  index?: number;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Countdown styling. Only genuinely near dates get colour — a page of cards
 * where every countdown is a bright chip has no hierarchy left to spend.
 */
function countdown(dateStr: string) {
  const d = daysUntil(dateStr);
  if (d < 0) return { text: `${Math.abs(d)} days ago`, cls: "text-[var(--charcoal)]/40" };
  if (d === 0) return { text: "Today", cls: "font-semibold text-[var(--terracotta)]" };
  if (d === 1) return { text: "Tomorrow", cls: "font-semibold text-[var(--terracotta)]" };
  if (d <= 7) return { text: `In ${d} days`, cls: "font-semibold text-[var(--terracotta)]" };
  if (d <= 30) return { text: `In ${d} days`, cls: "font-medium text-[hsl(38_45%_28%)]" };
  return { text: `In ${d} days`, cls: "text-[var(--charcoal)]/45" };
}

/** Compact labels — the full option labels are too long for a card chip. */
const SHORT_STATUS_LABEL: Record<string, string> = {
  like: "Liked",
  shortlisted: "Shortlisted",
  finalised: "Finalised",
  rejected: "Rejected",
  thinking: "Thinking",
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function ProjectCard({ project: p, canDelete, onArchiveToggle, onEdit, onDelete, index = 0 }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { ref, isVisible } = useRevealOnScroll<HTMLDivElement>();
  const archived = !!p.archived_at;
  const when = countdown(p.wedding_date);
  const finalised = p.quotes_summary?.finalised_vendors ?? 0;
  const vendors = p.vendor_count ?? 0;
  const progressPct = vendors > 0 ? Math.round((finalised / vendors) * 100) : 0;
  const closedTotal = p.quotes_summary?.closed_total_amount ?? 0;
  const saffronPicks = p.saffron_pick_count ?? 0;
  const counts = p.status_counts ?? {};
  // Only statuses the client has actually used — rendering all five meant four
  // zeroes of noise on a typical card.
  const activeStatuses = CLIENT_STATUS_OPTIONS.filter((o) => (counts[o.value] ?? 0) > 0);
  const dateLabel = new Date(p.wedding_date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      ref={ref}
      style={isVisible ? { animationDelay: `${Math.min(index, 12) * 40}ms` } : undefined}
      className={`group relative flex h-full flex-col rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-[var(--terracotta)] hover:shadow-[0_12px_28px_-12px_color-mix(in_srgb,var(--terracotta)_45%,transparent)] hover:ring-1 hover:ring-[var(--terracotta-soft)] ${isVisible ? "animate-fade-up" : "opacity-0"}`}
    >
      {/* top-right menu */}
      <div className="absolute right-2 top-2 z-10">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <DropdownMenuTrigger
            asChild
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              aria-label="Project actions"
              className="rounded p-1.5 text-[var(--charcoal)]/55 hover:bg-[var(--cream)] hover:text-[var(--terracotta)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onSelect={() => onEdit(p.id)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onArchiveToggle(p.id, !archived)}>
              {archived ? (
                <>
                  <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Unarchive
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                </>
              )}
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete(p.id)}
                  className="text-red-600 focus:text-red-700"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link
        to="/admin/projects/$id"
        params={{ id: p.id }}
        className="flex h-full flex-col"
      >
        {/* ── Couple + when ── */}
        <h3 className="pr-8 font-display text-xl leading-snug text-[var(--charcoal)]">
          {p.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {p.groom_name}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[var(--charcoal)]/70">
            <Calendar className="h-3.5 w-3.5 text-[var(--charcoal)]/40" />
            {dateLabel}
          </span>
          <span className="text-[var(--charcoal)]/25">·</span>
          {archived ? (
            <span className="rounded-full bg-[var(--charcoal)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/60">
              Archived
            </span>
          ) : (
            <span className={when.cls}>{when.text}</span>
          )}
        </div>

        {p.notes && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--charcoal)]/50">
            {p.notes}
          </p>
        )}

        {/* ── Progress band: the operational core, grouped as one unit ── */}
        <div className="mt-3 rounded-lg bg-[var(--cream)]/70 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-[var(--charcoal)]/60">
              <span className="font-display text-base font-semibold text-[var(--charcoal)]">
                {finalised}
              </span>
              <span className="text-[var(--charcoal)]/35"> / {vendors}</span> finalised
            </span>
            {closedTotal > 0 && (
              <span className="shrink-0 text-right">
                <span className="font-display text-base font-semibold text-[hsl(38_45%_28%)]">
                  {formatINRShort(closedTotal)}
                </span>
                <span className="ml-1 text-[10px] uppercase tracking-wider text-[var(--charcoal)]/40">
                  closed
                </span>
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--cream-deep)]">
            <div
              className="h-full rounded-full bg-[var(--terracotta)] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── Client responses — non-zero only, colour carried by the dot ── */}
        {activeStatuses.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {activeStatuses.map((o) => (
              <span
                key={o.value}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cream)] px-2 py-0.5 text-[11px] text-[var(--charcoal)]/65"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: o.dot }} />
                <span className="font-semibold tabular-nums text-[var(--charcoal)]">
                  {counts[o.value]}
                </span>
                {SHORT_STATUS_LABEL[o.value] ?? o.label}
              </span>
            ))}
          </div>
        )}

        {/* ── Footer meta ──
            The outer wrapper owns `mt-auto` (push to the bottom of a short
            card) plus a fixed `pt-3`. Putting both the auto margin and the
            rule on one element meant that once content filled the card the
            margin collapsed to 0 and the chips sat flush against the line. */}
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/60 pt-2.5 text-[11px] text-[var(--charcoal)]/45">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {p.client_count} client{p.client_count === 1 ? "" : "s"}
              </span>
              {saffronPicks > 0 && (
                <span className="inline-flex items-center gap-1 text-[var(--terracotta)]">
                  <Sparkles className="h-3 w-3 fill-current" /> {saffronPicks} pick{saffronPicks === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>{relativeTime(p.updated_at)}</span>
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-[var(--terracotta)]" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
