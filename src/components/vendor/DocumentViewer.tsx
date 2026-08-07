import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, Download, FileText, Loader2, ExternalLink, AlertTriangle } from "lucide-react";

interface DocumentViewerProps {
  url: string;
  fileName: string;
  mimeType: string | null;
  onClose: () => void;
}

type Kind = "pdf" | "image" | "video" | "office" | "other";

function detectKind(name: string, mime: string | null): Kind {
  const lower = name.toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|svg)$/.test(lower)) return "image";
  if (m.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv|avi)$/.test(lower)) return "video";
  if (/\.(docx?|pptx?|xlsx?)$/.test(lower) || m.includes("officedocument") || m.includes("msword") || m.includes("ms-excel") || m.includes("ms-powerpoint")) return "office";
  return "other";
}

/**
 * Fetches a remote file and returns a same-origin blob: URL.
 * Bypasses X-Frame-Options / CSP frame-ancestors restrictions imposed by
 * the file host (Supabase storage, Cloudflare, etc.) and browser-level
 * iframe blockers like Dia.
 */
function useBlobUrl(url: string, enabled: boolean) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(url, { credentials: "omit", mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const objUrl = URL.createObjectURL(blob);
        revoked = objUrl;
        setBlobUrl(objUrl);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load file");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [url, enabled]);

  return { blobUrl, loading, error };
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
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[var(--charcoal)]/90 px-4 py-3 text-[var(--cream)]">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-[var(--champagne)]" />
          <span className="truncate font-medium">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
            title="Open in a new browser tab"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
          </a>
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
        {kind === "pdf" && <PdfView url={url} fileName={fileName} />}
        {kind === "image" && <ImageView url={url} alt={fileName} />}
        {kind === "video" && <VideoView url={url} fileName={fileName} mimeType={mimeType} />}
        {(kind === "office" || kind === "other") && <FallbackView url={url} fileName={fileName} kind={kind} />}
      </div>
    </div>
  );
}

/* -------- Video: stream signed URL directly (supports Range/seek) -------- */
function VideoView({ url, fileName, mimeType }: { url: string; fileName: string; mimeType: string | null }) {
  const [failed, setFailed] = useState(false);
  const lower = fileName.toLowerCase();
  // Guess a playable type when the stored mime is missing/generic.
  const typeHint =
    mimeType && mimeType.startsWith("video/")
      ? mimeType
      : lower.endsWith(".mp4") || lower.endsWith(".m4v")
        ? "video/mp4"
        : lower.endsWith(".webm")
          ? "video/webm"
          : lower.endsWith(".mov")
            ? "video/quicktime"
            : undefined;

  if (failed) {
    return (
      <BlockedFallback
        url={url}
        fileName={fileName}
        reason="Your browser can't play this video format inline (often .mov / HEVC). Download it or open in a new tab to view."
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-black">
      <video
        controls
        autoPlay
        playsInline
        preload="metadata"
        
        className="max-h-full max-w-full"
        onError={() => setFailed(true)}
      >
        <source src={url} type={typeHint} />
        Your browser does not support inline video playback.
      </video>
    </div>
  );
}

/* -------- PDF: fetch as blob, render via same-origin blob: URL -------- */
function PdfView({ url, fileName }: { url: string; fileName: string }) {
  const { blobUrl, loading, error } = useBlobUrl(url, true);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-800/40 text-[var(--cream)]/80">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading document…
      </div>
    );
  }

  if (error || !blobUrl) {
    return <BlockedFallback url={url} fileName={fileName} reason={error} />;
  }

  return (
    <div className="relative h-full w-full bg-neutral-800/40">
      <iframe
        title="PDF preview"
        src={blobUrl}
        className="h-full w-full border-0 bg-white"
        referrerPolicy="no-referrer"
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
        <p className="mt-2 text-sm text-[var(--cream)]/85">
          {kind === "office"
            ? "Office documents (Word, Excel, PowerPoint) can't be previewed inline. Open them in a new tab or download to view."
            : "This file type isn't supported for inline preview."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium hover:bg-[var(--terracotta)]/90"
          >
            <ExternalLink className="h-4 w-4" /> Open in new tab
          </a>
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Download
          </a>
        </div>
      </div>
    </div>
  );
}

/* -------- Shown when fetch/blob fails (CORS, network, browser block) -------- */
function BlockedFallback({ url, fileName, reason }: { url: string; fileName: string; reason: string | null }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-white/10 bg-[var(--charcoal)]/70 p-8 text-center text-[var(--cream)]">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-[var(--champagne)]" />
        <h3 className="font-display text-2xl">Inline preview unavailable</h3>
        <p className="mt-2 text-sm text-[var(--cream)]/85">
          Your browser blocked the embedded preview{reason ? ` (${reason})` : ""}. You can still open the file directly.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium hover:bg-[var(--terracotta)]/90"
          >
            <ExternalLink className="h-4 w-4" /> Open in new tab
          </a>
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Download
          </a>
        </div>
      </div>
    </div>
  );
}
