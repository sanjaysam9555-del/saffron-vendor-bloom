import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { Vendor, VendorInput } from "@/lib/vendor-types";
import { useAllCategories, HOTEL_CATEGORIES, SOURCE_OPTIONS } from "@/lib/categories";

interface BulkEditDialogProps {
  open: boolean;
  vendors: Vendor[];
  onClose: () => void;
  onApply: (patch: Partial<VendorInput>) => Promise<void>;
}

type FieldKey =
  | "category"
  | "subcategory"
  | "location"
  | "price_text"
  | "commission_model"
  | "source"
  | "remarks"
  | "distance_from_delhi"
  | "hotel_category"
  | "team_size"
  | "deliverables"
  | "quote_breakdown"
  | "google_rating"
  | "number_of_rooms";

interface FieldDef {
  key: FieldKey;
  label: string;
  kind: "text" | "textarea" | "number" | "select-category" | "select-hotel" | "select-source";
  nullable: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "category", label: "Category", kind: "select-category", nullable: false },
  { key: "subcategory", label: "Subcategory", kind: "text", nullable: true },
  { key: "location", label: "Location", kind: "text", nullable: true },
  { key: "price_text", label: "Price text", kind: "text", nullable: true },
  { key: "commission_model", label: "Commission model", kind: "text", nullable: true },
  { key: "source", label: "Source", kind: "select-source", nullable: true },
  { key: "remarks", label: "Remarks", kind: "textarea", nullable: true },
  { key: "distance_from_delhi", label: "Distance from Delhi", kind: "text", nullable: true },
  { key: "hotel_category", label: "Hotel category", kind: "select-hotel", nullable: true },
  { key: "team_size", label: "Team size", kind: "text", nullable: true },
  { key: "deliverables", label: "Deliverables", kind: "textarea", nullable: true },
  { key: "quote_breakdown", label: "Quote breakdown", kind: "textarea", nullable: true },
  { key: "google_rating", label: "Google rating", kind: "number", nullable: true },
  { key: "number_of_rooms", label: "Number of rooms", kind: "number", nullable: true },
];

interface FieldState {
  enabled: boolean;
  clear: boolean;
  value: string;
}

const emptyState = (): Record<FieldKey, FieldState> =>
  Object.fromEntries(
    FIELDS.map((f) => [f.key, { enabled: false, clear: false, value: "" }]),
  ) as Record<FieldKey, FieldState>;

export function BulkEditDialog({ open, vendors, onClose, onApply }: BulkEditDialogProps) {
  const categories = useAllCategories();
  const [state, setState] = useState<Record<FieldKey, FieldState>>(() => emptyState());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const enabledFields = useMemo(
    () => FIELDS.filter((f) => state[f.key].enabled),
    [state],
  );

  const reset = () => {
    setState(emptyState());
    setConfirming(false);
    setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const buildPatch = (): { patch: Partial<VendorInput>; error?: string } => {
    const patch: Record<string, unknown> = {};
    for (const f of enabledFields) {
      const s = state[f.key];
      if (s.clear) {
        if (!f.nullable) return { patch: {}, error: `${f.label} cannot be cleared.` };
        patch[f.key] = null;
        continue;
      }
      if (f.kind === "number") {
        const trimmed = s.value.trim();
        if (!trimmed) return { patch: {}, error: `${f.label} needs a value or "Clear value".` };
        const n = Number(trimmed);
        if (Number.isNaN(n)) return { patch: {}, error: `${f.label} must be a number.` };
        patch[f.key] = n;
      } else {
        const v = s.value;
        if (v.trim() === "" && !f.nullable) {
          return { patch: {}, error: `${f.label} cannot be empty.` };
        }
        patch[f.key] = v.trim() === "" ? null : v;
      }
    }
    return { patch: patch as Partial<VendorInput> };
  };

  const handleApply = async () => {
    const { patch, error } = buildPatch();
    if (error) {
      toast.error(error);
      return;
    }
    if (Object.keys(patch).length === 0) {
      toast.error("Pick at least one field to update.");
      return;
    }
    setBusy(true);
    try {
      await onApply(patch);
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
      setBusy(false);
    }
  };

  if (!open) return null;

  const names = vendors.map((v) => v.vendor_name);
  const previewNames = names.slice(0, 6).join(", ");
  const moreCount = Math.max(0, names.length - 6);

  const renderInput = (f: FieldDef) => {
    const s = state[f.key];
    const set = (patch: Partial<FieldState>) =>
      setState((prev) => ({ ...prev, [f.key]: { ...prev[f.key], ...patch } }));

    const disabled = s.clear || !s.enabled;
    const baseCls =
      "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--charcoal)] focus:border-[var(--terracotta)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--cream-deep)]/60 disabled:text-[var(--charcoal)]/40";

    if (f.kind === "select-category") {
      return (
        <select disabled={disabled} value={s.value} onChange={(e) => set({ value: e.target.value })} className={baseCls}>
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      );
    }
    if (f.kind === "select-hotel") {
      return (
        <select disabled={disabled} value={s.value} onChange={(e) => set({ value: e.target.value })} className={baseCls}>
          <option value="">Select…</option>
          {HOTEL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    if (f.kind === "select-source") {
      return (
        <select disabled={disabled} value={s.value} onChange={(e) => set({ value: e.target.value })} className={baseCls}>
          <option value="">Select…</option>
          {SOURCE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    if (f.kind === "textarea") {
      return (
        <textarea
          disabled={disabled}
          value={s.value}
          onChange={(e) => set({ value: e.target.value })}
          rows={2}
          className={baseCls}
        />
      );
    }
    return (
      <input
        type={f.kind === "number" ? "number" : "text"}
        step={f.kind === "number" ? "any" : undefined}
        disabled={disabled}
        value={s.value}
        onChange={(e) => set({ value: e.target.value })}
        className={baseCls}
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-[var(--cream)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold text-[var(--charcoal)]">
              Editing {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 truncate text-xs text-[var(--charcoal)]/55" title={names.join(", ")}>
              {previewNames}{moreCount > 0 ? `, …and ${moreCount} more` : ""}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={busy}
            className="rounded-md p-1.5 text-[var(--charcoal)]/55 hover:bg-[var(--cream-deep)] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-xs text-[var(--charcoal)]/65">
            Tick "Update this field" for each field you want to change. Unchecked fields are left untouched per vendor.
            Use "Clear value" to set a nullable field to empty.
          </p>
          <div className="space-y-3">
            {FIELDS.map((f) => {
              const s = state[f.key];
              return (
                <div
                  key={f.key}
                  className={`rounded-lg border p-3 transition-colors ${
                    s.enabled ? "border-[var(--terracotta)]/40 bg-white" : "border-[var(--border)] bg-white/50"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--charcoal)]">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            [f.key]: { ...prev[f.key], enabled: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--terracotta)]"
                      />
                      Update {f.label.toLowerCase()}
                    </label>
                    {f.nullable && s.enabled && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--charcoal)]/65">
                        <input
                          type="checkbox"
                          checked={s.clear}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              [f.key]: { ...prev[f.key], clear: e.target.checked },
                            }))
                          }
                          className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--terracotta)]"
                        />
                        Clear value
                      </label>
                    )}
                  </div>
                  {s.enabled && !s.clear && renderInput(f)}
                  {s.enabled && s.clear && (
                    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--cream-deep)]/40 px-3 py-2 text-xs italic text-[var(--charcoal)]/55">
                      Will set {f.label.toLowerCase()} to empty for all selected vendors.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-white px-6 py-4">
          <div className="text-xs text-[var(--charcoal)]/65">
            {enabledFields.length === 0
              ? "No fields selected"
              : `${enabledFields.length} field${enabledFields.length === 1 ? "" : "s"} will be updated`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={busy}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-50"
            >
              Cancel
            </button>
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={enabledFields.length === 0 || busy}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply to {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm — update {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
