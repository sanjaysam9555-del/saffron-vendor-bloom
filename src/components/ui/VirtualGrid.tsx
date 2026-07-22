import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface VirtualGridProps<T> {
  items: T[];
  /** Map viewport width → column count. Default matches Tailwind sm/lg/xl card grid. */
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

const defaultGetColumns = (width: number) => {
  if (width >= 1280) return 4; // xl
  if (width >= 1024) return 3; // lg
  if (width >= 640) return 2; // sm
  return 1;
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
  overscan = 8,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(1);

  // Track viewport width → column count.
  useEffect(() => {
    const update = () => {
      const w = parentRef.current?.clientWidth ?? window.innerWidth;
      setColumns(getColumns(w));
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

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () =>
      typeof window === "undefined" ? null : (document.scrollingElement as HTMLElement) ?? document.documentElement,
    estimateSize: () => estimateRowHeight + gap,
    overscan,
    // Anchor virtual coordinates to parentRef's offset within the document.
    scrollMargin: parentRef.current?.getBoundingClientRect().top
      ? parentRef.current.getBoundingClientRect().top + window.scrollY
      : 0,
  });

  // Recompute scrollMargin once parent mounts.
  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const scrollMargin = rowVirtualizer.options.scrollMargin;

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
