import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Trash2, Upload, Sparkles } from "lucide-react";
import logoLight from "@/assets/saffron-logo-transparent.png";
import { HOTEL_CATEGORIES, BASE_CATEGORIES } from "@/lib/categories";
import { VendorSignupSuccess } from "@/components/vendor/VendorSignupSuccess";

export const Route = createFileRoute("/vendor-signup")({
  head: () => ({
    meta: [
      { title: "Partner With Us | Saffron Events Vendor Signup" },
      {
        name: "description",
        content:
          "List your business with Saffron Events — share your details with our planning team to be considered for upcoming weddings and events across India.",
      },
      { property: "og:title", content: "Partner With Us | Saffron Events" },
      {
        property: "og:description",
        content: "Vendors — register your business with Saffron Events.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: VendorSignupPage,
});

const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;

interface FormState {
  vendor_name: string;
  category: string;
  custom_category: string;
  subcategory: string;
  location: string;
  contact_number: string;
  email: string;
  instagram_handle: string;
  website: string;
  google_rating: string;
  price_text: string;
  commission_model: string;
  portfolio_link: string;
  remarks: string;
  number_of_rooms: string;
  distance_from_delhi: string;
  hotel_category: string;
  quote_breakdown: string;
  team_size: string;
  deliverables: string;
  honeypot: string;
}

const EMPTY: FormState = {
  vendor_name: "", category: "", custom_category: "", subcategory: "", location: "",
  contact_number: "", email: "", instagram_handle: "", website: "",
  google_rating: "", price_text: "", commission_model: "", portfolio_link: "", remarks: "",
  number_of_rooms: "", distance_from_delhi: "", hotel_category: "",
  quote_breakdown: "", team_size: "", deliverables: "",
  honeypot: "",
};

type FieldError = Partial<Record<keyof FormState, string>>;

const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none focus:ring-1 focus:ring-[var(--terracotta)]";
const inputErrCls =
  "w-full rounded-md border border-red-400 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-300";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function VendorSignupPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debouncers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isHotel = form.category === "Hotels & Venues";
  const isPhoto = form.category === "Photography & Videography";
  const isOtherCategory = form.category === "__other__";

  const clearFieldError = (k: keyof FormState) =>
    setFieldErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const next: File[] = [...files];
    for (const f of arr) {
      if (next.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed.`);
        break;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`"${f.name}" exceeds 20 MB limit.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (idx: number) => setFiles((cur) => cur.filter((_, i) => i !== idx));

  // Debounced background dedupe check on blur
  const checkField = async (field: "vendor_name" | "contact_number" | "email" | "instagram_handle", value: string) => {
    if (!value.trim()) return;
    try {
      const res = await fetch(
        `/api/public/vendor-signup/check?field=${field}&value=${encodeURIComponent(value)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { exists: boolean; message?: string };
      if (data.exists && data.message) {
        setFieldErrors((e) => ({ ...e, [field]: data.message! }));
      }
    } catch { /* silent */ }
  };

  const debouncedCheck = (field: "vendor_name" | "contact_number" | "email" | "instagram_handle", value: string) => {
    if (debouncers.current[field]) clearTimeout(debouncers.current[field]!);
    debouncers.current[field] = setTimeout(() => checkField(field, value), 250);
  };

  useEffect(() => {
    return () => {
      Object.values(debouncers.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  const validateLocally = (): boolean => {
    const errs: FieldError = {};
    if (!form.vendor_name.trim()) errs.vendor_name = "Required";
    if (!form.category) errs.category = "Required";
    if (form.category === "__other__" && !form.custom_category.trim()) {
      errs.custom_category = "Please specify your category";
    }
    if (!form.location.trim()) errs.location = "Required";
    if (!form.contact_number.trim()) errs.contact_number = "Required";
    if (!form.instagram_handle.trim()) errs.instagram_handle = "Required";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Enter a valid email";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validateLocally()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vendor_name: form.vendor_name.trim(),
        category: form.category === "__other__" ? form.custom_category.trim() : form.category,
        subcategory: form.subcategory.trim() || null,
        location: form.location.trim(),
        contact_number: form.contact_number.trim(),
        email: form.email.trim() || null,
        instagram_handle: form.instagram_handle.trim().replace(/^@+/, ""),
        website: form.website.trim() || null,
        google_rating: form.google_rating ? Number(form.google_rating) : null,
        price_text: form.price_text.trim() || null,
        commission_model: form.commission_model.trim() || null,
        portfolio_link: form.portfolio_link.trim() || null,
        remarks: form.remarks.trim() || null,
        number_of_rooms: form.number_of_rooms ? Number(form.number_of_rooms) : null,
        distance_from_delhi: form.distance_from_delhi.trim() || null,
        hotel_category: form.hotel_category || null,
        quote_breakdown: form.quote_breakdown.trim() || null,
        team_size: form.team_size.trim() || null,
        deliverables: form.deliverables.trim() || null,
        honeypot: form.honeypot,
      };

      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/public/vendor-signup", { method: "POST", body: fd });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        field?: keyof FormState;
        message?: string;
      };

      if (res.status === 409 && data.error === "duplicate" && data.field) {
        const msg = data.message ?? "This vendor is already registered with us.";
        setFieldErrors((e) => ({ ...e, [data.field as keyof FormState]: msg }));
        toast.error(msg);
        // Scroll the field into view
        setTimeout(() => {
          const el = document.querySelector(`[name="${data.field}"]`) as HTMLElement | null;
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.focus();
        }, 50);
        return;
      }

      if (!res.ok || !data.ok) {
        toast.error(data.message ?? "Could not submit. Please try again.");
        return;
      }

      setSuccess(payload.vendor_name);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForSubmitAnother = () => {
    setForm(EMPTY);
    setFiles([]);
    setFieldErrors({});
    setSuccess(null);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <header className="border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoLight} alt="Saffron Events" className="h-9 w-auto object-contain" />
            <div className="leading-tight hidden sm:block">
              <div className="font-display text-lg font-semibold text-[var(--terracotta)]">Saffron Events</div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--charcoal)]/55">Vendor Studio</div>
            </div>
          </Link>
          <Link to="/" className="text-xs text-[var(--charcoal)]/60 hover:text-[var(--terracotta)]">
            ← Back to homepage
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {success ? (
          <VendorSignupSuccess vendorName={success} onSubmitAnother={resetForSubmitAnother} />
        ) : (
          <>
            <div className="mb-8 text-center animate-fade-up">
              <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--terracotta-soft)] px-3 py-1 text-xs font-medium text-[var(--terracotta)]">
                <Sparkles className="h-3 w-3" /> Partner With Saffron Events
              </div>
              <h1 className="font-display text-4xl font-semibold text-[var(--charcoal)] sm:text-5xl">
                List your business with us
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--charcoal)]/65 sm:text-base">
                Share your details below — our planning team reviews every submission and reaches out
                when we have a project that fits your craft.
              </p>
            </div>

            <form
              key={formKey}
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-8 animate-fade-up"
              noValidate
            >
              {/* Honeypot — hidden from real users */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Leave this empty
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.honeypot}
                    onChange={(e) => set("honeypot", e.target.value)}
                  />
                </label>
              </div>

              <SectionTitle>About your business</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vendor / Brand Name" required error={fieldErrors.vendor_name} className="sm:col-span-2">
                  <input
                    name="vendor_name"
                    className={fieldErrors.vendor_name ? inputErrCls : inputCls}
                    value={form.vendor_name}
                    onChange={(e) => { set("vendor_name", e.target.value); clearFieldError("vendor_name"); }}
                    onBlur={(e) => debouncedCheck("vendor_name", e.target.value)}
                    required
                  />
                </Field>

                <Field label="Category" required error={fieldErrors.category}>
                  <select
                    name="category"
                    className={fieldErrors.category ? inputErrCls : inputCls}
                    value={form.category}
                    onChange={(e) => { set("category", e.target.value); clearFieldError("category"); }}
                    required
                  >
                    <option value="">Select a category…</option>
                    {BASE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__other__">Other (specify)</option>
                  </select>
                </Field>

                {isOtherCategory ? (
                  <Field label="Specify category" required error={fieldErrors.custom_category}>
                    <input
                      name="custom_category"
                      className={fieldErrors.custom_category ? inputErrCls : inputCls}
                      value={form.custom_category}
                      onChange={(e) => { set("custom_category", e.target.value); clearFieldError("custom_category"); }}
                      placeholder="e.g. Wedding Stationery"
                    />
                  </Field>
                ) : (
                  <Field label="Subcategory">
                    <input
                      name="subcategory"
                      className={inputCls}
                      value={form.subcategory}
                      onChange={(e) => set("subcategory", e.target.value)}
                      placeholder="e.g. Candid Photography"
                    />
                  </Field>
                )}

                <Field label="Location" required error={fieldErrors.location}>
                  <input
                    name="location"
                    className={fieldErrors.location ? inputErrCls : inputCls}
                    value={form.location}
                    onChange={(e) => { set("location", e.target.value); clearFieldError("location"); }}
                    placeholder="e.g. Gurugram"
                    required
                  />
                </Field>

                <Field label="Google Rating (0–5)">
                  <input
                    name="google_rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    className={inputCls}
                    value={form.google_rating}
                    onChange={(e) => set("google_rating", e.target.value)}
                  />
                </Field>
              </div>

              <SectionTitle>How we can reach you</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact Number" required error={fieldErrors.contact_number}>
                  <input
                    name="contact_number"
                    type="tel"
                    className={fieldErrors.contact_number ? inputErrCls : inputCls}
                    value={form.contact_number}
                    onChange={(e) => { set("contact_number", e.target.value); clearFieldError("contact_number"); }}
                    onBlur={(e) => debouncedCheck("contact_number", e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                  />
                </Field>

                <Field label="Email" error={fieldErrors.email}>
                  <input
                    name="email"
                    type="email"
                    className={fieldErrors.email ? inputErrCls : inputCls}
                    value={form.email}
                    onChange={(e) => { set("email", e.target.value); clearFieldError("email"); }}
                    onBlur={(e) => debouncedCheck("email", e.target.value)}
                    placeholder="hello@yourbrand.com"
                  />
                </Field>

                <Field label="Instagram Handle" required error={fieldErrors.instagram_handle}>
                  <input
                    name="instagram_handle"
                    className={fieldErrors.instagram_handle ? inputErrCls : inputCls}
                    value={form.instagram_handle}
                    onChange={(e) => { set("instagram_handle", e.target.value); clearFieldError("instagram_handle"); }}
                    onBlur={(e) => debouncedCheck("instagram_handle", e.target.value)}
                    placeholder="yourhandle (no @)"
                    required
                  />
                </Field>

                <Field label="Website">
                  <input
                    name="website"
                    className={inputCls}
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://yourbrand.com"
                  />
                </Field>
              </div>

              <SectionTitle>Pricing &amp; portfolio</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price" className="sm:col-span-2">
                  <input
                    name="price_text"
                    className={inputCls}
                    value={form.price_text}
                    onChange={(e) => set("price_text", e.target.value)}
                    placeholder="e.g. ₹3.5L – ₹12L, On discussion, ₹1500/plate"
                  />
                </Field>

                <Field label="Commission Model">
                  <input
                    name="commission_model"
                    className={inputCls}
                    value={form.commission_model}
                    onChange={(e) => set("commission_model", e.target.value)}
                    placeholder='e.g. "15%", "On discussion"'
                  />
                </Field>

                <Field label="Portfolio Link">
                  <input
                    name="portfolio_link"
                    className={inputCls}
                    value={form.portfolio_link}
                    onChange={(e) => set("portfolio_link", e.target.value)}
                    placeholder="Drive / Behance / Vimeo…"
                  />
                </Field>

                <Field label="Anything else we should know?" className="sm:col-span-2">
                  <textarea
                    name="remarks"
                    rows={3}
                    className={inputCls}
                    value={form.remarks}
                    onChange={(e) => set("remarks", e.target.value)}
                    placeholder="Highlights, notable past clients, USP…"
                  />
                </Field>
              </div>

              {isHotel && (
                <>
                  <SectionTitle>Hotel details</SectionTitle>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Number of Rooms">
                      <input
                        name="number_of_rooms"
                        type="number"
                        className={inputCls}
                        value={form.number_of_rooms}
                        onChange={(e) => set("number_of_rooms", e.target.value)}
                      />
                    </Field>
                    <Field label="Distance from Delhi">
                      <input
                        name="distance_from_delhi"
                        className={inputCls}
                        value={form.distance_from_delhi}
                        onChange={(e) => set("distance_from_delhi", e.target.value)}
                        placeholder="e.g. 65 km / 2 hr"
                      />
                    </Field>
                    <Field label="Hotel Category" className="sm:col-span-2">
                      <select
                        name="hotel_category"
                        className={inputCls}
                        value={form.hotel_category}
                        onChange={(e) => set("hotel_category", e.target.value)}
                      >
                        <option value="">Select…</option>
                        {HOTEL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>
                </>
              )}

              {isPhoto && (
                <>
                  <SectionTitle>Photography details</SectionTitle>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Quote Breakdown" className="sm:col-span-2">
                      <textarea
                        name="quote_breakdown"
                        rows={2}
                        className={inputCls}
                        value={form.quote_breakdown}
                        onChange={(e) => set("quote_breakdown", e.target.value)}
                      />
                    </Field>
                    <Field label="Team Size">
                      <input
                        name="team_size"
                        className={inputCls}
                        value={form.team_size}
                        onChange={(e) => set("team_size", e.target.value)}
                        placeholder="e.g. 8 person crew"
                      />
                    </Field>
                    <Field label="Deliverables">
                      <input
                        name="deliverables"
                        className={inputCls}
                        value={form.deliverables}
                        onChange={(e) => set("deliverables", e.target.value)}
                        placeholder="e.g. 500 photos + 8 min film"
                      />
                    </Field>
                  </div>
                </>
              )}

              {/* Documents */}
              <SectionTitle>Documents &amp; portfolio files</SectionTitle>
              <p className="mb-3 text-xs text-[var(--charcoal)]/60">
                Upload your rate card, brochure, sample work or anything else you'd like us to see.
                PDF, DOC, PPT, XLS, JPG, PNG, WEBP — max 20 MB each, up to {MAX_FILES} files.
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                  dragOver
                    ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)]"
                    : "border-[var(--border)] bg-[var(--cream-deep)]/40 hover:border-[var(--champagne)]"
                }`}
              >
                <Upload className="mb-1.5 h-6 w-6 text-[var(--terracotta)]" />
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

              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-[var(--champagne)] bg-[var(--cream-deep)] px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-[var(--charcoal)]/50">
                          {formatBytes(f.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="rounded p-1 text-[var(--charcoal)]/55 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--terracotta)] px-8 py-3 text-sm font-medium text-[var(--cream)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--terracotta)]/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit my details"}
                </button>
                <p className="text-center text-xs text-[var(--charcoal)]/50">
                  By submitting, you agree to be contacted by Saffron Events about potential collaborations.
                </p>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 border-b border-[var(--border)] pb-1.5 font-display text-lg text-[var(--terracotta)] first:mt-0">
      {children}
    </h2>
  );
}

function Field({
  label, required, error, children, className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-1 text-xs font-medium text-[var(--charcoal)]/70">
        {label}{required && <span className="ml-0.5 text-[var(--terracotta)]">*</span>}
      </div>
      {children}
      {error && <div className="mt-1 text-xs font-medium text-red-600">{error}</div>}
    </label>
  );
}
