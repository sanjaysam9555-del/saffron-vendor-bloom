import { useEffect, useState } from "react";
import { DocumentViewer } from "@/components/vendor/DocumentViewer";
import { getAttachmentUrl } from "@/lib/vendor-files-api";

interface Props {
  filePath: string;
  fileName: string;
  mimeType: string | null;
  onClose: () => void;
}

/**
 * Resolves a short-lived signed URL for a vendor file and renders it
 * in the shared DocumentViewer. Shows a lightweight loading state
 * while the URL is being signed.
 */
export function SignedDocumentViewer({ filePath, fileName, mimeType, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    getAttachmentUrl(filePath)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load file");
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="rounded-lg bg-white p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={onClose}
            className="mt-3 rounded-md bg-[var(--charcoal)] px-3 py-1.5 text-sm text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="rounded-lg bg-white px-4 py-3 text-sm text-[var(--charcoal)]">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <DocumentViewer url={url} fileName={fileName} mimeType={mimeType} onClose={onClose} />
  );
}
