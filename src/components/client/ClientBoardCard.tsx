import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MapPin, Star, GripVertical } from "lucide-react";
import type { ClientVendor } from "@/lib/project-types";
import { CATEGORY_COLORS } from "@/lib/categories";

interface Props {
  vendor: ClientVendor;
  onView: () => void;
}

export function ClientBoardCard({ vendor, onView }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: vendor.id,
    data: { vendor },
  });

  const colors = CATEGORY_COLORS[vendor.category] ?? {
    bg: "bg-[var(--cream-deep)]",
    text: "text-[var(--charcoal)]",
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-md border border-[var(--border)] bg-white p-2.5 text-[var(--charcoal)] shadow-sm transition-shadow ${
        isDragging ? "shadow-lg" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag vendor"
          className="-ml-0.5 mt-0.5 cursor-grab touch-none rounded p-0.5 text-[var(--charcoal)]/30 hover:bg-[var(--cream)] hover:text-[var(--charcoal)]/70 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={onView}
            className="block w-full text-left"
          >
            <h4 className="truncate text-sm font-semibold leading-snug">
              {vendor.vendor_name}
            </h4>
          </button>
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${colors.bg} ${colors.text}`}
            >
              {vendor.category}
            </span>
            {vendor.subcategory && (
              <span className="inline-flex items-center rounded-full bg-[var(--cream-deep)] px-1.5 py-0.5 text-[9px] text-[var(--charcoal)]/65">
                {vendor.subcategory}
              </span>
            )}
          </div>
          <div className="mt-1.5 space-y-0.5 text-[11px] text-[var(--charcoal)]/70">
            {vendor.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{vendor.location}</span>
              </div>
            )}
            {vendor.google_rating != null && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 shrink-0 fill-[var(--terracotta)] text-[var(--terracotta)]" />
                <span>{Number(vendor.google_rating).toFixed(1)}</span>
              </div>
            )}
            {vendor.price_text && (
              <div className="truncate font-medium text-[var(--terracotta)]">
                {vendor.price_text}
              </div>
            )}
          </div>
          <button
            onClick={onView}
            className="mt-2 text-[10px] font-medium uppercase tracking-wider text-[var(--terracotta)] hover:underline"
          >
            View details →
          </button>
        </div>
      </div>
    </div>
  );
}
