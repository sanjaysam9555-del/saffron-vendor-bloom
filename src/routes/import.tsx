import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Download, Upload, FileText, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

import { TopNav } from "@/components/vendor/TopNav";
import { VendorForm } from "@/components/vendor/VendorForm";
import { useVendors, useVendorMutations, useVendorModals } from "@/hooks/useVendorData";
import { CATEGORIES } from "@/lib/categories";
import { bulkInsertVendors, deleteSampleVendors } from "@/lib/vendor-api";
import { SAMPLE_VENDORS } from "@/lib/seed-data";
import { buildMapping, parseRows, parseTSV, dedupeAgainst, type ParsedRow } from "@/lib/csv-mapper";
import type { VendorInput } from "@/lib/vendor-types";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import / Export — Saffron Events" },
      { name: "description", content: "Bulk-import vendors from CSV or Google Sheets and export your full vendor book." },
    ],
  }),
  component: ImportPage,
});

const VENDOR_FIELDS: Array<keyof VendorInput> = [
  "vendor_name", "category", "subcategory", "location", "contact_number", "email",
  "instagram_handle", "website", "google_rating", "price_range_low", "price_range_high",
  "commission_model", "portfolio_link", "source", "remarks", "tags",
  "number_of_rooms", "distance_from_delhi", "hotel_category",
  "quote_breakdown", "team_size", "deliverables",
];

function ImportPage() {
  const { data: vendors = [], refetch } = useVendors();
  const { create } = useVendorMutations();
  const modals = useVendorModals();

  const [search, setSearch] = useState("");
  const [exportCategory, setExportCategory] = useState<string>("");
  const [pasteText, setPasteText] = useState("");
  const [parseResult, setParseResult] = useState<{ headers: string[]; mapping: Record<string, keyof VendorInput | null>; rows: ParsedRow[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const sampleCount = useMemo(() => vendors.filter((v) => v.source === "Sample Data").length, [vendors]);

  const exportCsv = (rows: typeof vendors, filename: string) => {
    const out = rows.map((v) => {
      const obj: Record<string, any> = {};
      VENDOR_FIELDS.forEach((f) => {
        const val = (v as any)[f];
        obj[f] = Array.isArray(val) ? val.join(", ") : val ?? "";
      });
      obj.date_added = v.date_added;
      return obj;
    });
    const csv = Papa.unparse(out);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleParseCSV = (text: string) => {
    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (!result.data.length) { setImportMsg("No rows found in input."); return; }
    const headers = result.meta.fields ?? [];
    const mapping = buildMapping(headers);
    const rows = parseRows(headers, result.data, mapping);
    setParseResult({ headers, mapping, rows });
    setImportMsg(null);
  };

  const handleParseTSV = () => {
    if (!pasteText.trim()) return;
    const { headers, rows: rawRows } = parseTSV(pasteText);
    if (!headers.length) { setImportMsg("Could not detect headers."); return; }
    const mapping = buildMapping(headers);
    const rows = parseRows(headers, rawRows, mapping);
    setParseResult({ headers, mapping, rows });
    setImportMsg(null);
  };

  const updateMapping = (header: string, field: keyof VendorInput | null) => {
    if (!parseResult) return;
    const newMapping = { ...parseResult.mapping, [header]: field };
    const rows = parseRows(parseResult.headers, parseResult.rows.map((r) => r.raw), newMapping);
    setParseResult({ ...parseResult, mapping: newMapping, rows });
  };

  const commitImport = async () => {
    if (!parseResult) return;
    const valid = parseResult.rows.filter((r) => r.errors.length === 0);
    const { unique, duplicates } = dedupeAgainst(valid, vendors);
    setImporting(true);
    try {
      const inserted = await bulkInsertVendors(unique.map((r) => r.data as VendorInput));
      await refetch();
      setImportMsg(`Imported ${inserted} vendors. ${duplicates} duplicates skipped. ${parseResult.rows.length - valid.length} rows had errors.`);
      setParseResult(null);
      setPasteText("");
    } catch (e: any) {
      setImportMsg(`Import failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  const filteredForExport = exportCategory ? vendors.filter((v) => v.category === exportCategory) : vendors;

  const handleClearSample = async () => {
    if (!confirm(`Delete ${sampleCount} sample vendors? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await deleteSampleVendors();
      await refetch();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--charcoal)]">
      <TopNav
        search={search}
        onSearchChange={setSearch}
        onAddVendor={() => modals.openCreate()}
        totalVendors={vendors.length}
        totalCategories={CATEGORIES.length}
      />

      <main className="mx-auto max-w-[1200px] space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Upload className="h-7 w-7 text-[var(--gold)]" />
          <div>
            <h1 className="font-display text-3xl text-white">Import & Export</h1>
            <p className="text-sm text-white/50">Bulk-load vendors from CSV / Google Sheets, or export your full directory.</p>
          </div>
        </div>

        {/* Export */}
        <Section title="Export" icon={<Download className="h-4 w-4" />}>
          <div className="flex flex-wrap items-end gap-3">
            <button
              onClick={() => exportCsv(vendors, `saffron-vendors-${new Date().toISOString().slice(0, 10)}.csv`)}
              className="rounded-md bg-[var(--gold)] px-4 py-2 text-sm font-medium text-[var(--charcoal)] hover:bg-[oklch(0.78_0.115_85)]"
            >
              Export All ({vendors.length})
            </button>
            <div className="flex items-end gap-2">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">By Category</div>
                <select value={exportCategory} onChange={(e) => setExportCategory(e.target.value)} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white focus:border-[var(--gold)] focus:outline-none">
                  <option value="">Select category…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c} ({vendors.filter(v => v.category === c).length})</option>)}
                </select>
              </div>
              <button
                disabled={!exportCategory}
                onClick={() => exportCsv(filteredForExport, `${exportCategory}-${new Date().toISOString().slice(0, 10)}.csv`)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-40"
              >
                Export Category
              </button>
            </div>
          </div>
        </Section>

        {/* Import: CSV upload */}
        <Section title="Import from CSV" icon={<FileText className="h-4 w-4" />}>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-sm text-white/60 hover:border-[var(--gold)] hover:text-white">
            <Upload className="h-5 w-5" />
            <span>Drag & drop a CSV here, or click to browse</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => handleParseCSV(String(reader.result ?? ""));
                reader.readAsText(f);
              }}
            />
          </label>
        </Section>

        {/* Paste from sheets */}
        <Section title="Paste from Google Sheets" icon={<FileText className="h-4 w-4" />}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={"Vendor Name\tCategory\tLocation\tPhone\tInstagram\nFoodlink\tCatering\tDelhi\t+91 98101 22334\tfoodlinkcaterers\n..."}
            className="w-full rounded-md border border-white/10 bg-white/5 p-3 text-xs font-mono text-white placeholder:text-white/30 focus:border-[var(--gold)] focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button onClick={handleParseTSV} disabled={!pasteText.trim()} className="rounded-md bg-[var(--gold)] px-3 py-1.5 text-sm font-medium text-[var(--charcoal)] hover:bg-[oklch(0.78_0.115_85)] disabled:opacity-50">
              Parse rows
            </button>
          </div>
        </Section>

        {/* Mapping preview */}
        {parseResult && (
          <Section title={`Preview & Confirm (${parseResult.rows.length} rows detected)`} icon={<CheckCircle2 className="h-4 w-4" />}>
            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {parseResult.headers.map((h) => (
                <div key={h} className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs">
                  <div className="mb-1 truncate text-white/60">"{h}"</div>
                  <select
                    value={parseResult.mapping[h] ?? ""}
                    onChange={(e) => updateMapping(h, (e.target.value || null) as keyof VendorInput | null)}
                    className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-[var(--gold)] focus:outline-none"
                  >
                    <option value="">— Skip column —</option>
                    {VENDOR_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className="px-2 py-1 text-left text-white/50">#</th>
                    <th className="px-2 py-1 text-left text-white/50">Vendor</th>
                    <th className="px-2 py-1 text-left text-white/50">Category</th>
                    <th className="px-2 py-1 text-left text-white/50">Location</th>
                    <th className="px-2 py-1 text-left text-white/50">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-2 py-1 text-white/40">{i + 1}</td>
                      <td className="px-2 py-1 text-white/80">{r.data.vendor_name ?? "—"}</td>
                      <td className="px-2 py-1 text-white/70">{r.data.category ?? "—"}</td>
                      <td className="px-2 py-1 text-white/70">{r.data.location ?? "—"}</td>
                      <td className="px-2 py-1">
                        {r.errors.length ? (
                          <span className="inline-flex items-center gap-1 text-red-400" title={r.errors.join("; ")}>
                            <AlertCircle className="h-3 w-3" /> {r.errors.length} issue{r.errors.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle2 className="h-3 w-3" /> Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.rows.length > 50 && (
                <div className="border-t border-white/5 px-2 py-1 text-center text-xs text-white/40">
                  …and {parseResult.rows.length - 50} more rows
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setParseResult(null)} className="rounded-md px-3 py-1.5 text-sm text-white/60 hover:bg-white/5">Cancel</button>
              <button onClick={commitImport} disabled={importing} className="rounded-md bg-[var(--gold)] px-3 py-1.5 text-sm font-medium text-[var(--charcoal)] hover:bg-[oklch(0.78_0.115_85)] disabled:opacity-50">
                {importing ? "Importing…" : `Import ${parseResult.rows.filter(r => r.errors.length === 0).length} rows`}
              </button>
            </div>
          </Section>
        )}

        {importMsg && (
          <div className="rounded-md border border-[var(--gold)]/40 bg-[var(--gold-soft)] p-3 text-sm text-[var(--gold)]">
            {importMsg}
          </div>
        )}

        {/* Sample data utilities */}
        <Section title="Sample Data" icon={<Trash2 className="h-4 w-4" />}>
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            {vendors.length === 0 ? (
              <>
                <span>Vendor book is empty.</span>
                <button
                  onClick={async () => { await bulkInsertVendors(SAMPLE_VENDORS); refetch(); }}
                  className="rounded-md bg-[var(--gold)] px-3 py-1.5 text-sm font-medium text-[var(--charcoal)] hover:bg-[oklch(0.78_0.115_85)]"
                >
                  Load {SAMPLE_VENDORS.length} sample vendors
                </button>
              </>
            ) : (
              <>
                <span>{sampleCount} sample vendors currently loaded.</span>
                {sampleCount > 0 && (
                  <button
                    onClick={handleClearSample}
                    disabled={clearing}
                    className="rounded-md border border-red-300/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {clearing ? "Clearing…" : "Clear sample data"}
                  </button>
                )}
              </>
            )}
          </div>
        </Section>
      </main>

      <VendorForm
        open={modals.state.formOpen}
        initial={modals.state.editing ?? modals.state.prefill}
        onClose={modals.closeForm}
        onSubmit={async (input) => { await create.mutateAsync(input); }}
      />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-[var(--gold)]">
        {icon}{title}
      </h2>
      {children}
    </section>
  );
}
