import { Instagram } from "lucide-react";
import { instagramUrl } from "@/lib/instagram";
import { SafeImg } from "./VendorInstagramPreview";
import type { VendorInstagramPreview } from "@/lib/instagram-preview.functions";

/**
 * Full-bleed 3-up Instagram media band for a card header. Shared by the
 * vendor directory card and the assigned-vendor card so both read as the same
 * design system rather than two different treatments of the same data.
 *
 * Always renders three slots regardless of how many thumbnails exist, so the
 * band is a fixed-height block whether the vendor has three photos, one, or
 * none — a partial row never leaves a ragged gap.
 */
export function VendorMediaBand({
  vendorId,
  instagramHandle,
  preview,
  heightClass = "h-28",
  overlay,
}: {
  vendorId: string;
  instagramHandle: string | null | undefined;
  preview?: VendorInstagramPreview | null;
  heightClass?: string;
  /** Rendered top-right over the media, e.g. a booked or closed-quote badge. */
  overlay?: React.ReactNode;
}) {
  const thumbs = preview?.post_thumbnails ?? [];
  const loading = preview === undefined && !!instagramHandle;
  const profileUrl = preview?.profile_url ?? (instagramHandle ? instagramUrl(instagramHandle) : null);

  return (
    <div className={`relative ${heightClass} shrink-0 overflow-hidden border-b border-[var(--border)] bg-[var(--cream)]`}>
      {loading ? (
        <div className="flex h-full animate-pulse gap-px">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 bg-[var(--cream-deep)]/70" />
          ))}
        </div>
      ) : thumbs.length > 0 ? (
        <div className="flex h-full gap-px">
          {[0, 1, 2].map((i) => {
            const src = thumbs[i];
            return (
              <div key={i} className="relative min-w-0 flex-1 overflow-hidden bg-[var(--cream-deep)]/60">
                {src ? (
                  <a
                    href={profileUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block h-full w-full"
                  >
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--terracotta)]/20">
                      <Instagram className="h-4 w-4" aria-hidden />
                    </span>
                    <SafeImg
                      src={src}
                      alt=""
                      eager
                      cache={{ vendorId: preview!.vendor_id, kind: "thumb" }}
                      className="relative h-full w-full object-cover"
                    />
                  </a>
                ) : (
                  <span className="flex h-full items-center justify-center text-[var(--terracotta)]/12">
                    <Instagram className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--charcoal)]/25">
          <Instagram className="h-5 w-5" aria-hidden />
          <span className="text-[9px] uppercase tracking-[0.16em]">
            {instagramHandle ? "No preview" : "No Instagram"}
          </span>
        </div>
      )}

      {overlay && <div className="absolute right-2 top-2 z-10 flex items-center gap-1">{overlay}</div>}
    </div>
  );
}
