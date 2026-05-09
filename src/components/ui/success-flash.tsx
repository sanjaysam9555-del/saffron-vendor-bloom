import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Brief inline check-mark that animates in and fades out. Driven by a
 * monotonically-changing `flashKey` — bump it (e.g. `Date.now()`) right
 * after a successful mutation to trigger a flash on the affected element.
 *
 * Pass `null`/`undefined`/`0` to render nothing.
 */
export function SuccessFlash({
  flashKey,
  className,
  size = "sm",
}: {
  flashKey: number | string | null | undefined;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!flashKey) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(t);
  }, [flashKey]);

  if (!visible) return null;

  const sizeClass =
    size === "xs"
      ? "h-3 w-3"
      : size === "md"
        ? "h-4 w-4"
        : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-green-100 text-green-700 success-pop",
        size === "xs" ? "p-0.5" : "p-1",
        className,
      )}
      aria-hidden
    >
      <Check className={sizeClass} />
    </span>
  );
}

/**
 * Wrap any element to flash its background briefly after a successful
 * mutation. Keep `flashKey` stable when nothing happened, then bump it
 * (e.g. `Date.now()`) to trigger the flash.
 */
export function FlashWrap({
  flashKey,
  children,
  className,
}: {
  flashKey: number | string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!flashKey) return;
    setArmed(false);
    // Force a paint, then re-arm so the animation always replays.
    const id = window.requestAnimationFrame(() => setArmed(true));
    const t = window.setTimeout(() => setArmed(false), 900);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [flashKey]);

  return (
    <div className={cn(armed && "flash-bg", className)}>{children}</div>
  );
}
