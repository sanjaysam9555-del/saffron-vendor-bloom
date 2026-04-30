import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, FileText, Loader2 } from "lucide-react";

// pdfjs-dist references browser-only globals (DOMMatrix) and must NOT be
// imported at module scope — that breaks SSR. Load it lazily on the client.
type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (typeof window === "undefined") return Promise.reject(new Error("pdfjs unavailable on server"));
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import("pdfjs-dist");
      // @ts-ignore - vite ?url import for the worker
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      mod.GlobalWorkerOptions.workerSrc = workerUrl;
      return mod;
    })();
  }
  return pdfjsPromise;
}

interface DocumentViewerProps {
  url: string;
  fileName: string;
  mimeType: string | null;
  onClose: () => void;
}

type Kind = "pdf" | "image" | "office" | "other";

function detectKind(name: string, mime: string | null): Kind {
  const lower = name.toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|svg)$/.test(lower)) return "image";
  if (/\.(docx?|pptx?|xlsx?)$/.test(lower) || m.includes("officedocument") || m.includes("msword") || m.includes("ms-excel") || m.includes("ms-powerpoint")) return "office";
  return "other";
}

export function DocumentViewer({ url, fileName, mimeType, onClose }: DocumentViewerProps) {
  const kind = detectKind(fileName, mimeType);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-sm animate-fade-in">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[var(--charcoal)]/90 px-4 py-3 text-[var(--cream)]">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-[var(--champagne)]" />
          <span className="truncate font-medium">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-white/10"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {kind === "pdf" && <PdfView url={url} />}
        {kind === "image" && <ImageView url={url} alt={fileName} />}
        {(kind === "office" || kind === "other") && <FallbackView url={url} fileName={fileName} kind={kind} />}
      </div>
    </div>
  );
}

/* -------- PDF -------- */
function PdfView({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load doc
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pdfjs.getDocument({ url }).promise
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setPage(1);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load PDF");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Render current page
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: any;
    (async () => {
      const p = await doc.getPage(page);
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const baseViewport = p.getViewport({ scale: 1 });
      const fitScale = Math.min(2.5, (containerWidth - 64) / baseViewport.width);
      const scale = Math.max(0.4, fitScale * zoom);
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTask = p.render({ canvas, canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
      } catch {
        /* cancelled */
      }
      if (cancelled) renderTask?.cancel?.();
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [doc, page, zoom]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!doc) return;
      if (e.key === "ArrowRight") setPage((p) => Math.min(doc.numPages, p + 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, z + 0.2));
      else if (e.key === "-") setZoom((z) => Math.max(0.4, z - 0.2));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="flex-1 overflow-auto bg-neutral-800/40 p-6">
        {loading && (
          <div className="flex h-full items-center justify-center text-[var(--cream)]/80">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading document…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-red-300">
            Failed to load PDF: {error}
          </div>
        )}
        {!loading && !error && (
          <div className="mx-auto w-fit shadow-2xl">
            <canvas ref={canvasRef} className="block bg-white" />
          </div>
        )}
      </div>

      {doc && (
        <footer className="flex items-center justify-center gap-2 border-t border-white/10 bg-[var(--charcoal)]/90 px-4 py-2 text-[var(--cream)]">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md p-1.5 hover:bg-white/10 disabled:opacity-30"
            title="Previous (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={1}
            max={doc.numPages}
            value={page}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= doc.numPages) setPage(n);
            }}
            className="w-14 rounded-md border border-white/15 bg-transparent px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-[var(--terracotta)]"
          />
          <span className="text-sm text-[var(--cream)]/70">/ {doc.numPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(doc.numPages, p + 1))}
            disabled={page >= doc.numPages}
            className="rounded-md p-1.5 hover:bg-white/10 disabled:opacity-30"
            title="Next (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mx-3 h-5 w-px bg-white/15" />
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="rounded-md p-1.5 hover:bg-white/10" title="Zoom out (-)">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="rounded-md p-1.5 hover:bg-white/10" title="Zoom in (+)">
            <ZoomIn className="h-4 w-4" />
          </button>
        </footer>
      )}
    </div>
  );
}

/* -------- Image -------- */
function ImageView({ url, alt }: { url: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto bg-neutral-800/40 p-6">
        <div className="mx-auto w-fit">
          <img
            src={url}
            alt={alt}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            className="block max-w-full rounded-md shadow-2xl transition-transform"
          />
        </div>
      </div>
      <footer className="flex items-center justify-center gap-2 border-t border-white/10 bg-[var(--charcoal)]/90 px-4 py-2 text-[var(--cream)]">
        <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="rounded-md p-1.5 hover:bg-white/10">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="rounded-md p-1.5 hover:bg-white/10">
          <ZoomIn className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}

/* -------- Office / unsupported -------- */
function FallbackView({ url, fileName, kind }: { url: string; fileName: string; kind: Kind }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-white/10 bg-[var(--charcoal)]/70 p-8 text-center text-[var(--cream)]">
        <FileText className="mx-auto mb-4 h-12 w-12 text-[var(--champagne)]" />
        <h3 className="font-display text-2xl">Preview not available</h3>
        <p className="mt-2 text-sm text-[var(--cream)]/70">
          {kind === "office"
            ? "Office documents (Word, Excel, PowerPoint) cannot be previewed in the browser."
            : "This file type isn't supported for inline preview."}{" "}
          Download the file to open it in your preferred application.
        </p>
        <a
          href={url}
          download={fileName}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium hover:bg-[var(--terracotta)]/90"
        >
          <Download className="h-4 w-4" /> Download {fileName}
        </a>
      </div>
    </div>
  );
}
