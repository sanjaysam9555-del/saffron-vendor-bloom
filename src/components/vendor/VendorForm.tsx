import { useEffect, useState } from "react";
import type { Vendor, VendorInput } from "@/lib/vendor-types";
import { CATEGORIES, HOTEL_CATEGORIES } from "@/lib/categories";
import { X } from "lucide-react";

interface VendorFormProps {
  open: boolean;
  initial?: Partial<VendorInput> | Vendor | null;
  onClose: () => void;
  onSubmit: (input: VendorInput) => Promise<void>;
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
  price_range_low: null,
  price_range_high: null,
  commission_model: null,
  portfolio_link: null,
  source: "Manual Entry",
  remarks: null,
  tags: [],
  number_of_rooms: null,
  distance_from_delhi: null,
  hotel_category: null,
  quote_breakdown: null,
  team_size: null,
  deliverables: null,
};

export function VendorForm({ open, initial, onClose, onSubmit }: VendorFormProps) {
  const [form, setForm] = useState<VendorInput>(EMPTY);
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const seed = { ...EMPTY, ...(initial ?? {}) } as VendorInput;
      setForm(seed);
      setTagsInput((seed.tags ?? []).join(", "));
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof VendorInput>(k: K, v: VendorInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const numField = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_name.trim() || !form.category) {
      setError("Vendor name and category are required");
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      await onSubmit({ ...form, tags });
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

          <Field label="Location">
            <input className={inputCls} value={form.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="e.g. Gurugram" />
          </Field>

          <Field label="Source">
            <select className={inputCls} value={form.source ?? "Manual Entry"} onChange={(e) => set("source", e.target.value)}>
              {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Contact Number">
            <input className={inputCls} value={form.contact_number ?? ""} onChange={(e) => set("contact_number", e.target.value || null)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email ?? ""} onChange={(e) => set("email", e.target.value || null)} />
          </Field>

          <Field label="Instagram Handle">
            <input className={inputCls} value={form.instagram_handle ?? ""} onChange={(e) => set("instagram_handle", e.target.value.replace(/^@/, "") || null)} placeholder="handle (no @)" />
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

          <Field label="Price Range Low (₹)">
            <input type="number" className={inputCls} value={form.price_range_low ?? ""} onChange={(e) => set("price_range_low", numField(e.target.value))} />
          </Field>
          <Field label="Price Range High (₹)">
            <input type="number" className={inputCls} value={form.price_range_high ?? ""} onChange={(e) => set("price_range_high", numField(e.target.value))} />
          </Field>

          <Field label="Portfolio Link" className="sm:col-span-2">
            <input className={inputCls} value={form.portfolio_link ?? ""} onChange={(e) => set("portfolio_link", e.target.value || null)} />
          </Field>

          <Field label="Tags (comma-separated)" className="sm:col-span-2">
            <input className={inputCls} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="premium, shortlisted, budget" />
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
