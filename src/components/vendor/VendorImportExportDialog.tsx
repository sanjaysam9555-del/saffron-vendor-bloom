import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import type { Vendor, VendorInput } from "@/lib/vendor-types";
import {
  VENDOR_CSV_FIELDS,
  buildTemplateCsv,
  downloadTextFile,
  parseVendorCsv,
  vendorsToCsv,
  type ParsedVendorRow,
} from "@/lib/vendor-csv";
import { useAllCategories, addCustomCategory } from "@/lib/categories";
import { notifyError, notifySuccess } from "@/lib/ui/feedback";

interface Props {
  open: boolean;
  vendors: Vendor[];
  onClose: () => void;
  onImport: (rows: VendorInput[]) => Promise<number>;
}

type Tab = "export" | "import";
type ImportStep = "pick" | "preview" | "done";

export function VendorImportExportDialog({ open, vendors, onClose, onImport }: Props) {
  const [tab, setTab] = useState<Tab>("export");
  const [step, setStep] = useState<ImportStep>("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedVendorRow[]>([]);
  const [unrecognizedColumns, setUnrecognizedColumns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categories = useAllCategories();

  const reset = () => {
    setTab("export");
    setStep("pick");
    setFileName(null);
    setRows([]);
    setUnrecognizedColumns([]);
    setBusy(false);
    setImportedCount(0);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleExport = () => {
    const csv = vendorsToCsv(vendors);
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`saffron-vendors-${date}.csv`, csv);
    notifySuccess(`Exported ${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`);
  };

  const handleDownloadTemplate = () => {
    downloadTextFile("saffron-vendor-import-template.csv", buildTemplateCsv());
  };

  const handleFilePicked = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const result = parseVendorCsv(text, categories);
    setRows(result.rows);
    setUnrecognizedColumns(result.unrecognizedColumns);
    setStep("preview");
  };

  const validRows = rows.filter((r) => r.input != null);
  const invalidRows = rows.filter((r) => r.input == null);
  const newCategoryNames = Array.from(
    new Set(validRows.filter((r) => r.isNewCategory).map((r) => r.input!.category)),
  );

  const handleConfirmImport = async () => {
    setBusy(true);
    try {
      // Register any categories the import introduces so filters/selects
      // pick them up immediately, then insert the vendors themselves.
      for (const name of newCategoryNames) {
        await addCustomCategory(name);
      }
      const count = await onImport(validRows.map((r) => r.input!));
      setImportedCount(count);
      setStep("done");
    } catch (err) {
      notifyError(err, "Import failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

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
            <h2 className="font-display text-2xl font-semibold text-[var(--charcoal)]">Import / Export Vendors</h2>
            <p className="mt-1 text-xs text-[var(--charcoal)]/55">
              {vendors.length} vendor{vendors.length === 1 ? "" : "s"} currently in your library
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

        <div className="flex border-b border-[var(--border)] bg-white px-6">
          {(["export", "import"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                if (busy) return;
                setTab(t);
              }}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "border-[var(--terracotta)] text-[var(--terracotta)]"
                  : "border-transparent text-[var(--charcoal)]/55 hover:text-[var(--charcoal)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "export" ? (
            <ExportPane vendors={vendors} onExport={handleExport} />
          ) : step === "pick" ? (
            <PickStep
              onDownloadTemplate={handleDownloadTemplate}
              onFilePicked={handleFilePicked}
              fileInputRef={fileInputRef}
            />
          ) : step === "preview" ? (
            <PreviewStep
              fileName={fileName}
              rows={rows}
              validCount={validRows.length}
              invalidCount={invalidRows.length}
              newCategoryNames={newCategoryNames}
              unrecognizedColumns={unrecognizedColumns}
              onPickAnother={() => setStep("pick")}
            />
          ) : (
            <DoneStep importedCount={importedCount} skippedCount={invalidRows.length} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-white px-6 py-4">
          {tab === "export" && (
            <button
              onClick={handleClose}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              Close
            </button>
          )}
          {tab === "import" && step === "pick" && (
            <button
              onClick={handleClose}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
            >
              Cancel
            </button>
          )}
          {tab === "import" && step === "preview" && (
            <>
              <button
                onClick={() => setStep("pick")}
                disabled={busy}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-50"
              >
                Choose a different file
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={busy || validRows.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {validRows.length} vendor{validRows.length === 1 ? "" : "s"}
              </button>
            </>
          )}
          {tab === "import" && step === "done" && (
            <button
              onClick={handleClose}
              className="rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportPane({ vendors, onExport }: { vendors: Vendor[]; onExport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center">
      <FileSpreadsheet className="h-10 w-10 text-[var(--terracotta)]" />
      <div>
        <p className="text-sm font-medium text-[var(--charcoal)]">
          Export {vendors.length} vendor{vendors.length === 1 ? "" : "s"} to CSV
        </p>
        <p className="mt-1 text-xs text-[var(--charcoal)]/55">
          Every field currently on each vendor's profile is included — opens cleanly in Excel, Sheets, or Numbers.
        </p>
      </div>
      <button
        onClick={onExport}
        disabled={vendors.length === 0}
        className="inline-flex items-center gap-2 rounded-md bg-[var(--terracotta)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        Download CSV
      </button>
    </div>
  );
}

function PickStep({
  onDownloadTemplate,
  onFilePicked,
  fileInputRef,
}: {
  onDownloadTemplate: () => void;
  onFilePicked: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-white p-4">
        <h3 className="text-sm font-semibold text-[var(--charcoal)]">How this works</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-[var(--charcoal)]/70">
          <li>
            Download the template below — it has every column the app understands, with one example row showing the
            expected format.
          </li>
          <li>
            Fill it in (or edit an exported file). <strong>Vendor Name</strong> and <strong>Category</strong> are the
            only required columns — everything else can be left blank.
          </li>
          <li>Upload the finished CSV file. You'll see a full preview before anything is saved.</li>
        </ol>
        <button
          onClick={onDownloadTemplate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV template
        </button>
      </div>

      <details className="rounded-lg border border-[var(--border)] bg-white p-4 text-xs text-[var(--charcoal)]/70">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--charcoal)]">
          Column reference ({VENDOR_CSV_FIELDS.length} columns)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {VENDOR_CSV_FIELDS.map((f) => (
            <div key={f.key} className="truncate">
              {f.header}
              {f.required && <span className="text-[var(--terracotta)]"> *</span>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-[var(--charcoal)]/50">* Required</p>
      </details>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void onFilePicked(file);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? "border-[var(--terracotta)] bg-[var(--terracotta-soft)]" : "border-[var(--border)] bg-white hover:border-[var(--terracotta)]/60"
        }`}
      >
        <Upload className="h-8 w-8 text-[var(--terracotta)]" />
        <p className="text-sm font-medium text-[var(--charcoal)]">Click to choose a CSV file, or drag it here</p>
        <p className="text-xs text-[var(--charcoal)]/55">.csv files only</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFilePicked(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function PreviewStep({
  fileName,
  rows,
  validCount,
  invalidCount,
  newCategoryNames,
  unrecognizedColumns,
  onPickAnother,
}: {
  fileName: string | null;
  rows: ParsedVendorRow[];
  validCount: number;
  invalidCount: number;
  newCategoryNames: string[];
  unrecognizedColumns: string[];
  onPickAnother: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--charcoal)]/55">
        Previewing <span className="font-medium text-[var(--charcoal)]">{fileName}</span> —{" "}
        <button onClick={onPickAnother} className="text-[var(--terracotta)] hover:underline">
          choose a different file
        </button>
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(142_55%_92%)] px-3 py-1.5 text-xs font-medium text-[hsl(142_55%_28%)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {validCount} ready to import
        </div>
        {invalidCount > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta-soft)] px-3 py-1.5 text-xs font-medium text-[var(--terracotta)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {invalidCount} row{invalidCount === 1 ? "" : "s"} will be skipped
          </div>
        )}
        {newCategoryNames.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--gold-soft)] px-3 py-1.5 text-xs font-medium text-[hsl(38_45%_28%)]">
            {newCategoryNames.length} new categor{newCategoryNames.length === 1 ? "y" : "ies"} will be created
          </div>
        )}
      </div>

      {unrecognizedColumns.length > 0 && (
        <p className="text-xs text-[var(--charcoal)]/50">
          Ignored columns not recognized: {unrecognizedColumns.join(", ")}
        </p>
      )}

      <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-white">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[var(--charcoal)] text-[10px] uppercase tracking-wider text-[var(--cream)]/80">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Vendor Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <tr key={r.rowNumber} className={r.input ? "" : "bg-[var(--terracotta-soft)]/40"}>
                <td className="px-3 py-2 text-[var(--charcoal)]/50">{r.rowNumber}</td>
                <td className="px-3 py-2 text-[var(--charcoal)]">{r.input?.vendor_name || "—"}</td>
                <td className="px-3 py-2 text-[var(--charcoal)]/70">
                  {r.input?.category || "—"}
                  {r.isNewCategory && (
                    <span className="ml-1.5 rounded-full bg-[var(--gold-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[hsl(38_45%_28%)]">
                      new
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.input ? (
                    <span className="inline-flex items-center gap-1 text-[hsl(142_55%_28%)]">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[var(--terracotta)]" title={r.errors.join(" ")}>
                      <AlertTriangle className="h-3 w-3" /> {r.errors[0]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DoneStep({ importedCount, skippedCount }: { importedCount: number; skippedCount: number }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center">
      <CheckCircle2 className="h-10 w-10 text-[hsl(142_55%_35%)]" />
      <p className="text-sm font-medium text-[var(--charcoal)]">
        Imported {importedCount} vendor{importedCount === 1 ? "" : "s"}
      </p>
      {skippedCount > 0 && (
        <p className="text-xs text-[var(--charcoal)]/55">
          {skippedCount} row{skippedCount === 1 ? "" : "s"} were skipped due to errors — fix them and re-import if needed.
        </p>
      )}
    </div>
  );
}
