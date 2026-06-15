import { Link } from "@tanstack/react-router";
import { Calendar, Heart, ArrowRight, Sparkles, Users, Archive, ArchiveRestore, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { useRevealOnScroll } from "@/hooks/use-reveal-on-scroll";
import { StatusCountsRow } from "@/components/admin/ClientStatusPill";
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

function urgencyChip(dateStr: string, archived: boolean) {
  if (archived) {
    return { label: "Archived", className: "bg-[var(--charcoal)]/10 text-[var(--charcoal)]/70" };
  }
  const d = daysUntil(dateStr);
  if (d < 0) return { label: `${Math.abs(d)}d ago`, className: "bg-[var(--cream-deep)] text-[var(--charcoal)]/60" };
  if (d === 0) return { label: "Today", className: "bg-[var(--terracotta)] text-[var(--cream)]" };
  if (d === 1) return { label: "Tomorrow", className: "bg-[var(--terracotta)] text-[var(--cream)]" };
  if (d <= 7) return { label: `In ${d}d`, className: "bg-[var(--terracotta-soft)] text-[var(--terracotta)]" };
  if (d <= 30) return { label: `In ${d}d`, className: "bg-amber-100 text-amber-800" };
  if (d <= 90) return { label: `In ${d}d`, className: "bg-emerald-50 text-emerald-800" };
  return { label: `In ${d}d`, className: "bg-[var(--cream-deep)] text-[var(--charcoal)]/65" };
}

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
  const chip = urgencyChip(p.wedding_date, archived);
  const finalised = p.quotes_summary?.finalised_vendors ?? 0;
  const vendors = p.vendor_count ?? 0;
  const progressPct = vendors > 0 ? Math.round((finalised / vendors) * 100) : 0;
  const closedTotal = p.quotes_summary?.closed_total_amount ?? 0;
  const saffronPicks = p.saffron_pick_count ?? 0;
  const counts = p.status_counts ?? { like: 0, shortlisted: 0, finalised: 0, rejected: 0, thinking: 0 };
  const dateLabel = new Date(p.wedding_date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
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
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--charcoal)]/55">
          <Heart className="h-3 w-3" /> Wedding
          <span className={`ml-auto mr-7 rounded-full px-2 py-0.5 text-[10px] font-semibold ${chip.className}`}>
            {chip.label}
          </span>
        </div>

        <h3 className="mt-1 pr-7 font-display text-xl text-[var(--charcoal)]">
          {p.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {p.groom_name}
        </h3>

        <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--charcoal)]/70">
          <Calendar className="h-3.5 w-3.5" />
          {dateLabel}
        </div>

        {p.notes && (
          <p className="mt-2 line-clamp-2 text-xs text-[var(--charcoal)]/55">{p.notes}</p>
        )}

        {/* progress strip */}
        <div className="mt-3 space-y-1">
          <div className="flex items-baseline justify-between text-[11px] text-[var(--charcoal)]/65">
            <span>
              <span className="font-semibold text-[var(--charcoal)]">{finalised}</span>
              {" / "}
              {vendors} vendor{vendors === 1 ? "" : "s"} finalised
            </span>
            {closedTotal > 0 && (
              <span className="font-medium text-emerald-800">
                ₹{formatINRShort(closedTotal)} closed
              </span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--cream-deep)]">
            <div
              className="h-full rounded-full bg-[var(--terracotta)] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* client status counts */}
        <div className="mt-3 min-h-[22px]">
          <StatusCountsRow counts={counts} />
        </div>

        {/* footer meta */}
        <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--charcoal)]/55">
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
          <div className="flex items-center gap-2">
            <span>Updated {relativeTime(p.updated_at)}</span>
            <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </div>
      </Link>
    </div>
  );
}
