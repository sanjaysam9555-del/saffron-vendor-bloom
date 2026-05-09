import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, Download, FileText, Loader2 } from "lucide-react";

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

/* -------- PDF: native browser viewer via iframe (much faster than pdfjs) -------- */
function PdfView({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-full w-full bg-neutral-800/40">
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--cream)]/80">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading document…
        </div>
      )}
      <iframe
        title="PDF preview"
        src={url}
        className="h-full w-full border-0 bg-white"
        onLoad={() => setLoading(false)}
      />
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
