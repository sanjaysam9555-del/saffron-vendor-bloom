import { toast } from "sonner";

/** Standardized success toast. */
export function notifySuccess(message: string, opts?: { description?: string }) {
  return toast.success(message, opts);
}

/**
 * Standardized error toast. Accepts an Error, string, or unknown.
 * Falls back to the supplied message when the error has no readable text.
 */
export function notifyError(err: unknown, fallback = "Something went wrong") {
  const msg =
    err instanceof Error && err.message
      ? err.message
      : typeof err === "string" && err
        ? err
        : fallback;
  return toast.error(msg);
}

/** Generic info toast. */
export function notifyInfo(message: string, opts?: { description?: string }) {
  return toast(message, opts);
}
