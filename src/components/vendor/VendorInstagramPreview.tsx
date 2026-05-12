import { Instagram, RefreshCw, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { VendorInstagramPreview as PreviewData } from "@/server/instagram-preview.functions";
import { useEnsureInstagramPreview, useRefreshInstagramPreview } from "@/hooks/use-instagram-previews";

function proxiedSrc(src: string): string {
  if (!src) return src;
  if (/^https?:\/\/[^/]*(cdninstagram\.com|fbcdn\.net)/i.test(src)) {
    return `/api/public/instagram-image?url=${encodeURIComponent(src)}`;
  }
  return src;
}

function SafeImg({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={proxiedSrc(src)}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setOk(false)}
    />
  );
}

interface CardProps {
  preview: PreviewData | null | undefined;
}

/**
 * Small additive strip for vendor cards. Renders nothing unless we have
 * a successfully cached preview. Never blocks the rest of the card.
 */
export function VendorInstagramCardStrip({ preview }: CardProps) {
  const thumbs = preview?.post_thumbnails ?? [];
  const hasAnything =
    preview?.status === "ok" &&
    (preview.avatar_url || thumbs.length > 0 || preview.display_name);

  if (!hasAnything) {
    return (
      <div className="mt-2 flex h-[96px] items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/30 p-2 text-[10px] text-[var(--charcoal)]/40">
        No Instagram preview
      </div>
    );
  }

  return (
    <div className="mt-2 h-[96px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--cream)]/40 p-2">
      <div className="flex items-center gap-2">
        {preview.avatar_url && (
          <SafeImg
            src={preview.avatar_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-[var(--border)]"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--charcoal)]">
            <Instagram className="h-3 w-3 text-[var(--terracotta)]" />
            <span className="truncate">{preview.display_name ?? `@${preview.handle ?? ""}`}</span>
          </div>
          {preview.bio && (
            <div className="truncate text-[10px] text-[var(--charcoal)]/60">{preview.bio}</div>
          )}
        </div>
      </div>
      {thumbs.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {thumbs.slice(0, 3).map((src, i) => (
            <a
              key={`${src}-${i}`}
              href={preview.profile_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block aspect-square overflow-hidden rounded-sm bg-[var(--cream-deep)]"
            >
              <SafeImg src={src} alt="" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface DetailProps {
  vendorId: string;
  handle: string | null | undefined;
  /** Show the admin-only "Refresh preview" button. */
  canRefresh?: boolean;
}

/**
 * Larger preview block for the vendor detail drawer. Triggers a server
 * fetch (cache-aware) when mounted. Falls back to a friendly placeholder
 * when nothing is available.
 */
export function VendorInstagramDetailBlock({ vendorId, handle, canRefresh = false }: DetailProps) {
  const { data: preview, isLoading } = useEnsureInstagramPreview(vendorId, handle ?? null);
  const refresh = useRefreshInstagramPreview();

  if (!handle) return null;

  const status = preview?.status;
  const thumbs = preview?.post_thumbnails ?? [];

  return (
    <div className="border-t border-[var(--border)] px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
          <Instagram className="h-3 w-3" /> Instagram Preview
        </div>
        {canRefresh && (
          <button
            type="button"
            onClick={() => refresh.mutate({ vendorId, handle })}
            disabled={refresh.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {isLoading && !preview && (
        <div className="text-xs text-[var(--charcoal)]/55">Loading preview…</div>
      )}

      {!isLoading && (!preview || status !== "ok") && (
        <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/30 p-3 text-xs text-[var(--charcoal)]/60">
          {status === "not_found"
            ? "Profile is private or unavailable."
            : status === "error"
              ? "Couldn't fetch preview right now."
              : "No preview cached yet."}
          {canRefresh && (
            <button
              type="button"
              onClick={() => refresh.mutate({ vendorId, handle })}
              disabled={refresh.isPending}
              className="ml-2 underline hover:text-[var(--terracotta)] disabled:opacity-50"
            >
              {refresh.isPending ? "Fetching…" : "Try fetching"}
            </button>
          )}
        </div>
      )}

      {preview && status === "ok" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {preview.avatar_url && (
              <SafeImg
                src={preview.avatar_url}
                alt={preview.display_name ?? "Instagram avatar"}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-[var(--border)]"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--charcoal)]">
                {preview.display_name ?? `@${preview.handle ?? ""}`}
              </div>
              {preview.handle && (
                <div className="text-[11px] text-[var(--charcoal)]/55">@{preview.handle}</div>
              )}
              {preview.followers_text && (
                <div className="mt-0.5 text-[11px] text-[var(--charcoal)]/70">
                  {preview.followers_text}
                </div>
              )}
              {preview.bio && (
                <div className="mt-1 whitespace-pre-wrap text-xs text-[var(--charcoal)]/75">
                  {preview.bio}
                </div>
              )}
            </div>
          </div>

          {thumbs.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {thumbs.slice(0, 3).map((src, i) => (
                <a
                  key={`${src}-${i}`}
                  href={preview.profile_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square overflow-hidden rounded-md bg-[var(--cream-deep)] ring-1 ring-[var(--border)]"
                >
                  <SafeImg src={src} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}

          {preview.profile_url && (
            <a
              href={preview.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--terracotta)] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Open on Instagram
            </a>
          )}
        </div>
      )}
    </div>
  );
}
