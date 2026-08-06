import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface VirtualGridProps<T> {
  items: T[];
  /** Map *container* width → column count. See `defaultGetColumns`. */
  getColumns?: (width: number) => number;
  /** Estimated row height in px (single card). Tune per use. */
  estimateRowHeight?: number;
  /** Horizontal gap in px between cards. */
  gap?: number;
  /** Renders a single item. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable id extractor for keys. */
  getKey: (item: T) => string;
  /** Extra Tailwind classes for the inner row container. */
  className?: string;
  /** Overscan rows above/below viewport. */
  overscan?: number;
}

/** Narrowest a card may get before we drop a column. */
const MIN_CARD_WIDTH = 165;
const COLUMN_GAP = 16;
/** Real phones — viewport, not container. */
const PHONE_VIEWPORT = 640;
const MAX_COLUMNS = 4;

/**
 * Column count from the *container* width, not the viewport.
 *
 * This used to test viewport-scale breakpoints (1280/1024/640) against a value
 * that is actually the grid's own width. With the admin sidebar and the vendor
 * filter rail both open, that width drops to ~500px, which fell into the
 * "<640 = 1 column" bucket and rendered a single card per row on a laptop.
 *
 * Packing by a minimum card width instead makes the grid respond to whatever
 * space it actually has, so collapsing either rail immediately gains columns.
 * The phone check reads the viewport deliberately: a narrow *container* on a
 * laptop (both rails open) is not a phone and should still show a pair.
 */
const defaultGetColumns = (width: number) => {
  if (typeof window !== "undefined" && window.innerWidth < PHONE_VIEWPORT) return 1;
  const fit = Math.floor((width + COLUMN_GAP) / (MIN_CARD_WIDTH + COLUMN_GAP));
  return Math.max(2, Math.min(MAX_COLUMNS, fit));
};

/**
 * Window-virtualized responsive card grid. Uses the document scroll element
 * so it works seamlessly inside the existing page layout (no inner scroller).
 * Only rows whose cards are in (or near) the viewport are mounted.
 */
export function VirtualGrid<T>({
  items,
  getColumns = defaultGetColumns,
  estimateRowHeight = 420,
  gap = 16,
  renderItem,
  getKey,
  className = "",
  overscan = 3,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(1);
  // Held in state, not read during render. Reading getBoundingClientRect() in
  // the render body fed a value that changed on every scroll into the
  // virtualizer options, which destabilised the range calculation and made it
  // mount the entire list instead of a window.
  const [scrollMargin, setScrollMargin] = useState(0);

  // Track viewport width → column count, and the list's document offset.
  useEffect(() => {
    const update = () => {
      const el = parentRef.current;
      if (!el) return;
      setColumns(getColumns(el.clientWidth || window.innerWidth));
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    if (parentRef.current) ro.observe(parentRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [getColumns]);

  const rowCount = Math.ceil(items.length / Math.max(columns, 1));

  // Window virtualizer, not useVirtualizer against document.scrollingElement:
  // react-virtual sizes the viewport from getBoundingClientRect(), and on
  // <html> that returns the whole document height (~280,000px here), so every
  // row counted as visible and the entire list mounted.
  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimateRowHeight + gap,
    overscan,
    scrollMargin,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  return (
    <div ref={parentRef} className={className} style={{ position: "relative" }}>
      <div style={{ height: totalHeight, width: "100%", position: "relative" }}>
        {virtualRows.map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const start = rowIndex * columns;
          const rowItems = items.slice(start, start + columns);
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                  paddingBottom: `${gap}px`,
                }}
              >
                {rowItems.map((item, i) => (
                  <div key={getKey(item)} style={{ minWidth: 0 }}>
                    {renderItem(item, start + i)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
