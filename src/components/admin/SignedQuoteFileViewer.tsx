import { useEffect, useState } from "react";
import { DocumentViewer } from "@/components/vendor/DocumentViewer";
import { getQuoteFileUrl } from "@/lib/quote-api";

interface Props {
  filePath: string;
  fileName: string;
  mimeType: string | null;
  onClose: () => void;
}

export function SignedQuoteFileViewer({ filePath, fileName, mimeType, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    getQuoteFileUrl(filePath)
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
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
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
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
        <div className="rounded-lg bg-white px-4 py-3 text-sm text-[var(--charcoal)]">
          Loading…
        </div>
      </div>
    );
  }

  return <DocumentViewer url={url} fileName={fileName} mimeType={mimeType} onClose={onClose} />;
}
