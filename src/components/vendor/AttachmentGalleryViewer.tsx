import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, AlertTriangle } from "lucide-react";
import { getAttachmentUrl } from "@/lib/vendor-files-api";
import type { AttachmentLike } from "./AttachmentThumbnailGrid";

interface Props {
  attachments: AttachmentLike[];
  initialId: string;
  onClose: () => void;
}

function isImage(att: AttachmentLike): boolean {
  const m = (att.mime_type ?? "").toLowerCase();
  const n = att.file_name.toLowerCase();
  return m.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|svg|bmp)$/.test(n);
}

export function AttachmentGalleryViewer({ attachments, initialId, onClose }: Props) {
  const images = useMemo(() => attachments.filter(isImage), [attachments]);
  const initialIndex = Math.max(0, images.findIndex((a) => a.id === initialId));
  const [index, setIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
  const [zoom, setZoom] = useState(1);

  const current = images[index];
  const total = images.length;

  const prev = () => {
    setZoom(1);
    setIndex((i) => (i - 1 + total) % total);
  };
  const next = () => {
    setZoom(1);
    setIndex((i) => (i + 1) % total);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && total > 1) prev();
      else if (e.key === "ArrowRight" && total > 1) next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, onClose]);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || total <= 1) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) prev();
    else next();
  };

  if (!current) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[var(--charcoal)]/90 px-4 py-3 text-[var(--cream)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate font-medium">{current.file_name}</span>
          {total > 1 && (
            <span className="shrink-0 text-xs text-[var(--cream)]/60 tabular-nums">
              {index + 1} / {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DownloadLink att={current} />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-white/10"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <GalleryImage key={current.id} att={current} zoom={zoom} />

        {total > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      <footer className="flex items-center justify-center gap-2 border-t border-white/10 bg-[var(--charcoal)]/90 px-4 py-2 text-[var(--cream)]">
        <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="rounded-md p-1.5 hover:bg-white/10">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(4, z + 0.2))} className="rounded-md p-1.5 hover:bg-white/10">
          <ZoomIn className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}

function GalleryImage({ att, zoom }: { att: AttachmentLike; zoom: number }) {
  const { data: url, isLoading, isError } = useQuery({
    queryKey: ["att-full", att.file_path],
    queryFn: () => getAttachmentUrl(att.file_path),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--cream)]/80">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading image…
      </div>
    );
  }
  if (isError || !url) {
    return (
      <div className="flex items-center gap-2 text-[var(--cream)]/80">
        <AlertTriangle className="h-5 w-5 text-[var(--champagne)]" /> Couldn't load this image.
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={att.file_name}
      draggable={false}
      style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
      className="max-h-full max-w-full select-none object-contain transition-transform"
    />
  );
}

function DownloadLink({ att }: { att: AttachmentLike }) {
  const { data: url } = useQuery({
    queryKey: ["att-full", att.file_path],
    queryFn: () => getAttachmentUrl(att.file_path),
    staleTime: 5 * 60_000,
  });
  if (!url) return null;
  return (
    <a
      href={url}
      download={att.file_name}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
    >
      <Download className="h-3.5 w-3.5" /> Download
    </a>
  );
}
