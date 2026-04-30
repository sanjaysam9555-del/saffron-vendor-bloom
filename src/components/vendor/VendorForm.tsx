import { useEffect, useRef, useState } from "react";
import type { Vendor, VendorInput } from "@/lib/vendor-types";
import { CATEGORIES, HOTEL_CATEGORIES } from "@/lib/categories";
import { X, Upload, Paperclip, Trash2 } from "lucide-react";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  deleteVendorAttachment,
  formatFileSize,
  listVendorAttachments,
  uploadVendorAttachment,
  type VendorAttachment,
} from "@/lib/vendor-files-api";

interface VendorFormProps {
  open: boolean;
  initial?: Partial<VendorInput> | Vendor | null;
  onClose: () => void;
  onSubmit: (input: VendorInput) => Promise<Vendor>;
}

const EMPTY: VendorInput = {
  vendor_name: "",
  category: "",
  subcategory: null,
  location: null,
  contact_number: null,
  email: null,
  instagram_handle: null,
  website: null,
  google_rating: null,
  price_text: null,
  commission_model: null,
  portfolio_link: null,
  source: "Manual Entry",
  remarks: null,
  number_of_rooms: null,
  distance_from_delhi: null,
  hotel_category: null,
  quote_breakdown: null,
  team_size: null,
  deliverables: null,
};

export function VendorForm({ open, initial, onClose, onSubmit }: VendorFormProps) {
  const [form, setForm] = useState<VendorInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<VendorAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editingId = (initial as Vendor | null | undefined)?.id ?? null;

  useEffect(() => {
    if (open) {
      const seed = { ...EMPTY, ...(initial ?? {}) } as VendorInput;
      setForm(seed);
      setError(null);
      setPendingFiles([]);
      setExisting([]);
      if (editingId) {
        listVendorAttachments(editingId).then(setExisting).catch(() => setExisting([]));
      }
    }
  }, [open, initial, editingId]);

  if (!open) return null;

  const set = <K extends keyof VendorInput>(k: K, v: VendorInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const numField = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const accepted: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`"${f.name}" exceeds 20 MB limit`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length) setPendingFiles((cur) => [...cur, ...accepted]);
  };

  const removePending = (idx: number) =>
    setPendingFiles((cur) => cur.filter((_, i) => i !== idx));

  const removeExisting = async (att: VendorAttachment) => {
    setExisting((cur) => cur.filter((a) => a.id !== att.id));
    try {
      await deleteVendorAttachment(att);
    } catch {
      // restore on failure
      setExisting((cur) => [att, ...cur]);
      setError("Failed to delete attachment");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_name.trim() || !form.category) {
      setError("Vendor name and category are required");
      return;
    }
    if (!form.location?.trim()) {
      setError("Location is required");
      return;
    }
    if (!form.contact_number?.trim()) {
      setError("Contact number is required");
      return;
    }
    if (!form.instagram_handle?.trim()) {
      setError("Instagram handle is required");
      return;
    }
    setSubmitting(true);
    try {
      const saved = await onSubmit(form);
      // Upload pending files
      for (const file of pendingFiles) {
        try {
          await uploadVendorAttachment(saved.id, file);
        } catch (e: any) {
          setError(`Saved vendor, but failed to upload "${file.name}": ${e?.message ?? "error"}`);
        }
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save vendor");
    } finally {
      setSubmitting(false);
    }
  };

  const isHotel = form.category === "Hotels & Venues";
  const isPhoto = form.category === "Photography & Videography";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-[var(--cream)] text-[oklch(0.18_0.01_60)] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--cream)] px-6 py-4">
          <h2 className="font-display text-2xl">{(initial as Vendor)?.id ? "Edit Vendor" : "Add Vendor"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-[var(--cream-deep)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Vendor Name *" className="sm:col-span-2">
            <input className={inputCls} value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} required />
          </Field>

          <Field label="Category *">
            <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} required>
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Subcategory">
            <input className={inputCls} value={form.subcategory ?? ""} onChange={(e) => set("subcategory", e.target.value || null)} placeholder="e.g. Candid Photography" />
          </Field>

          <Field label="Location *">
            <input className={inputCls} required value={form.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="e.g. Gurugram" />
          </Field>

          <Field label="Contact Number *">
            <input className={inputCls} required value={form.contact_number ?? ""} onChange={(e) => set("contact_number", e.target.value || null)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email ?? ""} onChange={(e) => set("email", e.target.value || null)} />
          </Field>

          <Field label="Instagram Handle *">
            <input className={inputCls} required value={form.instagram_handle ?? ""} onChange={(e) => set("instagram_handle", e.target.value.replace(/^@/, "") || null)} placeholder="handle (no @)" />
          </Field>
          <Field label="Website">
            <input className={inputCls} value={form.website ?? ""} onChange={(e) => set("website", e.target.value || null)} />
          </Field>

          <Field label="Google Rating (0-5)">
            <input type="number" step="0.1" min="0" max="5" className={inputCls} value={form.google_rating ?? ""} onChange={(e) => set("google_rating", numField(e.target.value))} />
          </Field>
          <Field label="Commission Model">
            <input className={inputCls} value={form.commission_model ?? ""} onChange={(e) => set("commission_model", e.target.value || null)} placeholder='e.g. "15%", "On discussion"' />
          </Field>

          <Field label="Price" className="sm:col-span-2">
            <input
              className={inputCls}
              value={form.price_text ?? ""}
              onChange={(e) => set("price_text", e.target.value || null)}
              placeholder="e.g. ₹3.5L – ₹12L, On discussion, ₹1500/plate"
            />
          </Field>

          <Field label="Portfolio Link" className="sm:col-span-2">
            <input className={inputCls} value={form.portfolio_link ?? ""} onChange={(e) => set("portfolio_link", e.target.value || null)} />
          </Field>

          <Field label="Remarks" className="sm:col-span-2">
            <textarea rows={3} className={inputCls} value={form.remarks ?? ""} onChange={(e) => set("remarks", e.target.value || null)} />
          </Field>

          {isHotel && (
            <>
              <div className="sm:col-span-2 mt-2 border-t border-[var(--border)] pt-3 font-display text-lg text-[var(--terracotta)]">Hotel Details</div>
              <Field label="Number of Rooms">
                <input type="number" className={inputCls} value={form.number_of_rooms ?? ""} onChange={(e) => set("number_of_rooms", numField(e.target.value))} />
              </Field>
              <Field label="Distance from Delhi">
                <input className={inputCls} value={form.distance_from_delhi ?? ""} onChange={(e) => set("distance_from_delhi", e.target.value || null)} placeholder="e.g. 65 km / 2 hr" />
              </Field>
              <Field label="Hotel Category" className="sm:col-span-2">
                <select className={inputCls} value={form.hotel_category ?? ""} onChange={(e) => set("hotel_category", e.target.value || null)}>
                  <option value="">Select…</option>
                  {HOTEL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </>
          )}

          {isPhoto && (
            <>
              <div className="sm:col-span-2 mt-2 border-t border-[var(--border)] pt-3 font-display text-lg text-[var(--terracotta)]">Photography RFP</div>
              <Field label="Quote Breakdown" className="sm:col-span-2">
                <textarea rows={2} className={inputCls} value={form.quote_breakdown ?? ""} onChange={(e) => set("quote_breakdown", e.target.value || null)} />
              </Field>
              <Field label="Team Size">
                <input className={inputCls} value={form.team_size ?? ""} onChange={(e) => set("team_size", e.target.value || null)} placeholder="e.g. 8 person crew" />
              </Field>
              <Field label="Deliverables">
                <input className={inputCls} value={form.deliverables ?? ""} onChange={(e) => set("deliverables", e.target.value || null)} placeholder="e.g. 500 photos + 8 min film" />
              </Field>
            </>
          )}
        </div>

        {/* Attachments */}
        <div className="border-t border-[var(--border)] px-6 py-5">
          <div className="mb-2 flex items-center gap-2 font-display text-lg text-[var(--terracotta)]">
            <Paperclip className="h-4 w-4" /> Attachments
          </div>
          <p className="mb-3 text-xs text-[var(--charcoal)]/60">
            PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, JPG, PNG, WEBP — max 20 MB each.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)]"
                : "border-[var(--border)] bg-white hover:border-[var(--champagne)]"
            }`}
          >
            <Upload className="mb-1.5 h-5 w-5 text-[var(--terracotta)]" />
            <div className="text-sm font-medium text-[var(--charcoal)]">Drag & drop files here</div>
            <div className="text-xs text-[var(--charcoal)]/55">or click to browse</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {(existing.length > 0 || pendingFiles.length > 0) && (
            <ul className="mt-3 space-y-1.5">
              {existing.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--charcoal)]/55" />
                    <span className="truncate">{att.file_name}</span>
                    <span className="shrink-0 text-xs text-[var(--charcoal)]/50">
                      {formatFileSize(att.size_bytes)}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--cream-deep)] px-1.5 py-0.5 text-[10px] text-[var(--charcoal)]/55">
                      saved
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExisting(att)}
                    className="rounded p-1 text-[var(--charcoal)]/55 hover:bg-red-50 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {pendingFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--champagne)] bg-[var(--cream-deep)] px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-[var(--charcoal)]/50">
                      {formatFileSize(f.size)}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--terracotta-soft)] px-1.5 py-0.5 text-[10px] text-[var(--terracotta)]">
                      pending
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="rounded p-1 text-[var(--charcoal)]/55 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="px-6 pb-2 text-sm text-red-600">{error}</div>}

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--cream)] px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--charcoal)]/65 hover:bg-[var(--cream-deep)]">Cancel</button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Vendor"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm focus:border-[var(--terracotta)] focus:outline-none focus:ring-1 focus:ring-[var(--terracotta)]";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-1 text-xs font-medium text-[var(--charcoal)]/65">{label}</div>
      {children}
    </label>
  );
}
