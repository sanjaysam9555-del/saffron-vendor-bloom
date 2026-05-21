import { useQuery } from "@tanstack/react-query";
import { FileText, Play, ImageOff } from "lucide-react";
import { getAttachmentUrl, getAttachmentStreamUrl, formatFileSize } from "@/lib/vendor-files-api";

export interface AttachmentLike {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
}

interface Props<T extends AttachmentLike> {
  attachments: T[];
  onOpen: (att: T) => void;
}

function classify(att: AttachmentLike): "image" | "video" | "file" {
  const mime = (att.mime_type ?? "").toLowerCase();
  const name = att.file_name.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(name)) return "video";
  return "file";
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toUpperCase() : "FILE";
}

export function AttachmentThumbnailGrid<T extends AttachmentLike>({ attachments, onOpen }: Props<T>) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {attachments.map((att) => {
        const kind = classify(att);
        return (
          <button
            key={att.id}
            type="button"
            onClick={() => onOpen(att)}
            className="group flex flex-col overflow-hidden rounded-md border border-[var(--border)] bg-white text-left transition-colors hover:border-[var(--terracotta)]"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-[var(--cream-deep)]">
              {kind === "image" && <ImageTile filePath={att.file_path} alt={att.file_name} />}
              {kind === "video" && <VideoTile filePath={att.file_path} />}
              {kind === "file" && <FileTile name={att.file_name} />}
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="line-clamp-2 break-all text-xs text-[var(--charcoal)] group-hover:text-[var(--terracotta)]">
                {att.file_name}
              </span>
              <span className="text-[10px] text-[var(--charcoal)]/55">
                {formatFileSize(att.size_bytes)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ImageTile({ filePath, alt }: { filePath: string; alt: string }) {
  const { data: url, isError } = useQuery({
    queryKey: ["att-url", filePath],
    queryFn: () => getAttachmentUrl(filePath),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  if (isError) return <Fallback icon={<ImageOff className="h-6 w-6" />} />;
  if (!url) return <div className="h-full w-full animate-pulse bg-[var(--cream-deep)]" />;
  return <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" />;
}

function VideoTile({ filePath }: { filePath: string }) {
  const { data: url, isError } = useQuery({
    queryKey: ["att-stream", filePath],
    queryFn: () => getAttachmentStreamUrl(filePath),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  if (isError) return <Fallback icon={<Play className="h-6 w-6" />} />;
  if (!url) return <div className="h-full w-full animate-pulse bg-[var(--cream-deep)]" />;
  return (
    <>
      <video
        src={url}
        preload="metadata"
        muted
        playsInline
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="rounded-full bg-white/90 p-2 shadow">
          <Play className="h-5 w-5 fill-[var(--charcoal)] text-[var(--charcoal)]" />
        </div>
      </div>
    </>
  );
}

function FileTile({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--charcoal)]/70">
      <FileText className="h-10 w-10 text-[var(--terracotta)]" />
      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--charcoal)]/70">
        {extOf(name)}
      </span>
    </div>
  );
}

function Fallback({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-[var(--charcoal)]/40">
      {icon}
    </div>
  );
}
