import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, type ReactNode } from "react";

interface VirtualTableProps<T> {
  items: T[];
  estimateRowHeight?: number;
  overscan?: number;
  renderHeader: () => ReactNode;
  renderRow: (item: T, index: number) => ReactNode;
  getKey: (item: T) => string;
  /** Number of <td> spans for the spacer rows. */
  columnCount: number;
  /** Optional className on the outer scroll container. */
  className?: string;
  /** Minimum table width (for horizontal scroll on small screens). */
  minWidth?: number;
}

/**
 * Window-virtualized table. Uses the document scroll element so it stays
 * inside the page's natural scroll. We render <tr> spacer rows for the
 * total height and absolute-positioned rows are NOT possible in a real
 * <table>, so instead we render top + bottom spacer rows that total to
 * the missing vertical space.
 */
export function VirtualTable<T>({
  items,
  estimateRowHeight = 56,
  overscan = 8,
  renderHeader,
  renderRow,
  getKey,
  columnCount,
  className = "",
  minWidth,
}: VirtualTableProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () =>
      typeof window === "undefined" ? null : (document.scrollingElement as HTMLElement) ?? document.documentElement,
    estimateSize: () => estimateRowHeight,
    overscan,
    scrollMargin: containerRef.current
      ? containerRef.current.getBoundingClientRect().top + window.scrollY
      : 0,
  });

  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div ref={containerRef} className={className}>
      <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
        {renderHeader()}
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden style={{ height: paddingTop }}>
              <td colSpan={columnCount} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) return null;
            return (
              <tr
                key={getKey(item)}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
              >
                {/* renderRow returns the <td> cells; we wrap them in this <tr>.
                    Callers should NOT include their own <tr>. */}
                {renderRow(item, virtualRow.index)}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden style={{ height: paddingBottom }}>
              <td colSpan={columnCount} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
