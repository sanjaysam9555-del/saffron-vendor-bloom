import { Instagram, RefreshCw, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { VendorInstagramPreview as PreviewData } from "@/lib/instagram-preview.functions";
import { useInstagramPreviewFromCache, useRefreshInstagramPreview } from "@/hooks/use-instagram-previews";

function proxiedSrc(
  src: string,
  cache?: { vendorId: string; kind: "avatar" | "thumb" },
): string {
  if (!src) return src;
  if (/^https?:\/\/[^/]*(cdninstagram\.com|fbcdn\.net)/i.test(src)) {
    const params = new URLSearchParams({ url: src });
    if (cache?.vendorId) {
      params.set("vendorId", cache.vendorId);
      params.set("kind", cache.kind);
    }
    return `/api/public/instagram-image?${params.toString()}`;
  }
  return src;
}

export function SafeImg({
  src,
  alt,
  className,
  eager = false,
  cache,
}: {
  src: string;
  alt: string;
  className: string;
  eager?: boolean;
  cache?: { vendorId: string; kind: "avatar" | "thumb" };
}) {
  const [ok, setOk] = useState(true);
  // Reset error state when src changes so a previously-failed URL
  // doesn't poison a later successful one (e.g. after mirror refresh).
  useEffect(() => {
    setOk(true);
  }, [src]);
  if (!ok) {
    return (
      <span className={`${className} flex items-center justify-center bg-[var(--cream-deep)] text-[var(--terracotta)]/55`}>
        <Instagram className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <img
      src={proxiedSrc(src, cache)}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onLoad={(event) => {
        const img = event.currentTarget;
        // Our image proxy returns a tiny fallback SVG when an old Instagram
        // CDN URL has expired. Treat that as a failed image so the branded
        // fallback renders instead of a blank cream square.
        if (img.naturalWidth <= 2 && img.naturalHeight <= 2) setOk(false);
      }}
      onError={() => setOk(false)}
    />
  );
}

interface CardProps {
  preview: PreviewData | null | undefined;
  /** Whether the vendor has an Instagram handle at all. */
  hasHandle?: boolean;
}

/**
 * Small additive strip for vendor cards. Renders a skeleton while the
 * preview is loading (vendor has a handle but no cached row yet), the real
 * preview when available, and a friendly fallback otherwise.
 */
export function VendorInstagramCardStrip({ preview, hasHandle = true }: CardProps) {
  // Vendor has no Instagram handle — render nothing.
  if (!hasHandle && preview == null) return null;

  // Loading: bulk fetch in flight. Once it resolves, `preview` will be a row
  // or null and we drop into the render branches below.
  if (preview === undefined) {
    return (
      <div className="mt-2 min-h-[148px] animate-pulse rounded-md border border-[var(--border)] bg-[var(--cream)]/40 p-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[var(--cream-deep)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-2/3 rounded bg-[var(--cream-deep)]" />
            <div className="h-2 w-1/2 rounded bg-[var(--cream-deep)]/70" />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          <div className="aspect-square rounded-sm bg-[var(--cream-deep)]" />
          <div className="aspect-square rounded-sm bg-[var(--cream-deep)]" />
          <div className="aspect-square rounded-sm bg-[var(--cream-deep)]" />
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mt-2 flex min-h-[148px] items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/30 p-2 text-[10px] text-[var(--charcoal)]/58">
        No Instagram preview
      </div>
    );
  }

  const thumbs = preview.post_thumbnails ?? [];
  const hasAnything =
    preview.status === "ok"
      ? preview.avatar_url || thumbs.length > 0 || preview.display_name || preview.profile_url || preview.handle
      : preview.profile_url || preview.handle;

  if (!hasAnything) {
    return (
      <div className="mt-2 flex min-h-[148px] items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/30 p-2 text-[10px] text-[var(--charcoal)]/58">
        No Instagram preview
      </div>
    );
  }

  return (
    <div className="mt-2 min-h-[148px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--cream)]/40 p-2">
      <div className="flex items-center gap-2">
        {preview.avatar_url && (
          <SafeImg
            src={preview.avatar_url}
            alt=""
            eager
            cache={{ vendorId: preview.vendor_id, kind: "avatar" }}
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--charcoal)]">
            <Instagram className="h-3 w-3 shrink-0 text-[var(--terracotta)]" />
            <span className="truncate">{preview.display_name ?? `@${preview.handle ?? ""}`}</span>
          </div>
          {preview.bio && (
            <div className="truncate text-[10px] text-[var(--charcoal)]/74">{preview.bio}</div>
          )}
        </div>
      </div>
      {thumbs.length > 0 && (
        <div className="mt-2 grid min-w-0 grid-cols-3 gap-1">
          {thumbs.slice(0, 3).map((src, i) => (
            <a
              key={`${src}-${i}`}
              href={preview.profile_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="relative block aspect-square min-w-0 overflow-hidden rounded-sm bg-[var(--cream-deep)]"
            >
              {/* Baseline glyph so a slow-loading thumbnail never renders as an empty square. */}
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--terracotta)]/25">
                <Instagram className="h-4 w-4" aria-hidden />
              </span>
              <SafeImg
                src={src}
                alt=""
                eager
                cache={{ vendorId: preview.vendor_id, kind: "thumb" }}
                className="relative h-full w-full object-cover"
              />
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
  const preview = useInstagramPreviewFromCache(vendorId, handle ?? null);
  const refresh = useRefreshInstagramPreview();

  if (!handle) return null;

  const status = preview?.status;
  const thumbs = preview?.post_thumbnails ?? [];

  return (
    <div className="border-t border-[var(--border)] px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/70">
          <Instagram className="h-3 w-3" /> Instagram Preview
        </div>
        {canRefresh && (
          <button
            type="button"
            onClick={() => refresh.mutate({ vendorId, handle })}
            disabled={refresh.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--charcoal)]/82 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
            {refresh.isPending ? "Fetching…" : "Refresh"}
          </button>
        )}
      </div>

      {(!preview || status !== "ok") && (
        <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/30 p-3 text-xs text-[var(--charcoal)]/74">
          {status === "not_found"
            ? "Profile is private or unavailable."
            : status === "error"
              ? "Couldn't fetch preview right now."
              : "No preview cached yet."}
          <a
            href={`https://www.instagram.com/${handle}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline break-all hover:text-[var(--terracotta)]"
          >
            Open @{handle} on Instagram
          </a>
        </div>
      )}

      {preview && status === "ok" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {preview.avatar_url ? (
              <SafeImg
                src={preview.avatar_url}
                alt={preview.display_name ?? "Instagram avatar"}
                eager
                cache={{ vendorId, kind: "avatar" }}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-[var(--border)]"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--cream-deep)] ring-2 ring-[var(--border)]">
                <Instagram className="h-5 w-5 text-[var(--terracotta)]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--charcoal)]">
                {preview.display_name ?? `@${preview.handle ?? handle}`}
              </div>
              {preview.handle && (
                <div className="text-[11px] text-[var(--charcoal)]/70">@{preview.handle}</div>
              )}
              {preview.followers_text && (
                <div className="mt-0.5 text-[11px] text-[var(--charcoal)]/82">
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
            <div className="grid min-w-0 grid-cols-3 gap-2">
              {thumbs.slice(0, 3).map((src, i) => (
                <a
                  key={`${src}-${i}`}
                  href={preview.profile_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square min-w-0 overflow-hidden rounded-md bg-[var(--cream-deep)] ring-1 ring-[var(--border)]"
                >
                  <SafeImg
                    src={src}
                    alt=""
                    eager
                    cache={{ vendorId, kind: "thumb" }}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          {(preview.profile_url || handle) && (
            <a
              href={preview.profile_url ?? `https://www.instagram.com/${handle}/`}
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
