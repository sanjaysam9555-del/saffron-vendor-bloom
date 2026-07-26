import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Plus,
  FileText,
  Paperclip,
  Trash2,
  Pencil,
  Check,
  Upload,
  Loader2,
  CircleCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import {
  listProjectVendorQuotes,
  createProjectVendorQuote,
  updateProjectVendorQuote,
  closeProjectVendorQuote,
  deleteProjectVendorQuote,
  uploadQuoteFiles,
  deleteQuoteFile,
  QUOTE_ACCEPTED_FILE_TYPES,
  QUOTE_MAX_FILE_SIZE,
} from "@/lib/quote-api";
import {
  getQuoteCommission,
  setQuoteCommission,
} from "@/lib/quote-commission.functions";
import {
  type ProjectVendorQuote,
  type QuoteFile,
  type QuoteStatus,
  QUOTE_STATUS_LABEL,
  formatINR,
} from "@/lib/quote-types";
import { formatFileSize } from "@/lib/vendor-files-api";
import { SignedQuoteFileViewer } from "./SignedQuoteFileViewer";

interface Props {
  projectId: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string | null;
  autoOpenForm?: boolean;
  onClose: () => void;
}

export function ProjectVendorQuotesPanel({
  projectId,
  vendorId,
  vendorName,
  vendorCategory,
  autoOpenForm,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const queryKey = ["project-vendor-quotes", projectId, vendorId];

  const { data: quotes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listProjectVendorQuotes(projectId, vendorId),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["vendor-booked-summary"] });
  };

  const [showAdd, setShowAdd] = useState(!!autoOpenForm);
  const [editing, setEditing] = useState<ProjectVendorQuote | null>(null);
  const [viewing, setViewing] = useState<QuoteFile | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-[var(--cream)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
              Quotes
            </div>
            <h2 className="font-display text-xl text-[var(--charcoal)]">{vendorName}</h2>
            {vendorCategory && (
              <div className="text-xs text-[var(--charcoal)]/60">{vendorCategory}</div>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--cream-deep)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--cream-deep)]/40 px-5 py-2.5">
          <div className="text-xs text-[var(--charcoal)]/65">
            {isLoading ? "Loading…" : `${quotes.length} quote${quotes.length === 1 ? "" : "s"}`}
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowAdd(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add quote
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {quotes.length === 0 && !showAdd && (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-white py-10 text-center text-sm text-[var(--charcoal)]/60">
              No quotes yet for this vendor on this project.
            </div>
          )}

          {showAdd && (
            <div className="mb-4">
              <QuoteForm
                projectId={projectId}
                vendorId={vendorId}
                vendorCategory={vendorCategory}
                quote={null}
                onCancel={() => setShowAdd(false)}
                onSaved={() => {
                  setShowAdd(false);
                  refresh();
                }}
              />
            </div>
          )}

          <ul className="space-y-3">
            {quotes.map((q) =>
              editing?.id === q.id ? (
                <li key={q.id}>
                  <QuoteForm
                    projectId={projectId}
                    vendorId={vendorId}
                    vendorCategory={vendorCategory}
                    quote={q}
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      refresh();
                    }}
                    onViewFile={setViewing}
                  />
                </li>
              ) : (
                <li key={q.id}>
                  <QuoteRow
                    quote={q}
                    onEdit={() => setEditing(q)}
                    onClose={async (amt) => {
                      try {
                        await closeProjectVendorQuote(q.id, amt);
                        toast.success("Quote marked as closed");
                        refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                    onDelete={async () => {
                      const ok = await confirmDelete({
                        title: "Delete this quote?",
                        description: "The quote and all attached files will be removed.",
                        confirmLabel: "Delete quote",
                      });
                      if (!ok) return;
                      try {
                        await deleteProjectVendorQuote(q);
                        toast.success("Quote deleted");
                        refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                    onWithdraw={async () => {
                      try {
                        await updateProjectVendorQuote({ id: q.id, status: "withdrawn" });
                        refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                    onViewFile={setViewing}
                  />
                </li>
              ),
            )}
          </ul>
        </div>
      </div>

      {viewing && (
        <SignedQuoteFileViewer
          filePath={viewing.file_path}
          fileName={viewing.file_name}
          mimeType={viewing.mime_type}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function statusChip(status: QuoteStatus, isFinal: boolean) {
  if (status === "closed" || isFinal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-800">
        <CircleCheck className="h-3 w-3" /> Closed
      </span>
    );
  }
  if (status === "withdrawn") {
    return (
      <span className="rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--charcoal)]/55">
        Withdrawn
      </span>
    );
  }
  if (status === "revised") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
        Revised
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--terracotta-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--terracotta)]">
      {QUOTE_STATUS_LABEL[status]}
    </span>
  );
}

function QuoteRow({
  quote,
  onEdit,
  onClose,
  onDelete,
  onWithdraw,
  onViewFile,
}: {
  quote: ProjectVendorQuote;
  onEdit: () => void;
  onClose: (amount: number | null) => void;
  onDelete: () => void;
  onWithdraw: () => void;
  onViewFile: (f: QuoteFile) => void;
}) {
  const [showCloseInput, setShowCloseInput] = useState(false);
  const [closedAmt, setClosedAmt] = useState<string>(
    quote.quote_amount != null ? String(quote.quote_amount) : "",
  );

  const headlineAmount =
    quote.status === "closed" && quote.closed_amount != null
      ? quote.closed_amount
      : quote.quote_amount;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {statusChip(quote.status, quote.is_final)}
            {headlineAmount != null && (
              <span className="font-semibold text-[var(--charcoal)]">
                {formatINR(headlineAmount)}
              </span>
            )}
            {quote.files.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--charcoal)]/60">
                <Paperclip className="h-3 w-3" /> {quote.files.length}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--charcoal)]/55">
            {new Date(quote.created_at).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onEdit}
            title="Edit"
            className="rounded p-1.5 text-[var(--charcoal)]/60 hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="rounded p-1.5 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {quote.quote_text && (
        <div className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--cream-deep)]/50 p-2 text-sm text-[var(--charcoal)]/85">
          {quote.quote_text}
        </div>
      )}

      {quote.notes && (
        <div className="mt-2 text-xs text-[var(--charcoal)]/60">
          <span className="font-semibold">Notes:</span> {quote.notes}
        </div>
      )}

      {quote.files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {quote.files.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onViewFile(f)}
                className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--cream)]/60 px-2.5 py-1.5 text-left text-xs hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                  <span className="truncate text-[var(--charcoal)] group-hover:text-[var(--terracotta)]">
                    {f.file_name}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] text-[var(--charcoal)]/55">
                  {formatFileSize(f.size_bytes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {quote.status !== "closed" && quote.status !== "withdrawn" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
          {showCloseInput ? (
            <>
              <span className="text-xs text-[var(--charcoal)]/65">Closed at ₹</span>
              <input
                type="number"
                inputMode="decimal"
                className="w-32 rounded border border-[var(--border)] px-2 py-1 text-sm"
                value={closedAmt}
                onChange={(e) => setClosedAmt(e.target.value)}
                placeholder="amount"
              />
              <button
                onClick={() => {
                  const n = closedAmt.trim() === "" ? null : Number(closedAmt);
                  onClose(Number.isFinite(n as number) ? (n as number) : null);
                  setShowCloseInput(false);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                <Check className="h-3 w-3" /> Confirm
              </button>
              <button
                onClick={() => setShowCloseInput(false)}
                className="rounded-md px-2 py-1 text-xs hover:bg-[var(--cream-deep)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowCloseInput(true)}
                className="inline-flex items-center gap-1 rounded-md border border-green-600/40 bg-green-50 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
              >
                <CircleCheck className="h-3 w-3" /> Mark closed
              </button>
              <button
                onClick={onWithdraw}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--charcoal)]/65 hover:bg-[var(--cream-deep)]"
              >
                Withdraw
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuoteForm({
  projectId,
  vendorId,
  vendorCategory,
  quote,
  onCancel,
  onSaved,
  onViewFile,
}: {
  projectId: string;
  vendorId: string;
  vendorCategory: string | null;
  quote: ProjectVendorQuote | null;
  onCancel: () => void;
  onSaved: () => void;
  onViewFile?: (f: QuoteFile) => void;
}) {
  const confirmDelete = useConfirmDelete();
  const isEdit = !!quote;
  const [amount, setAmount] = useState<string>(
    quote?.quote_amount != null ? String(quote.quote_amount) : "",
  );
  const [text, setText] = useState<string>(quote?.quote_text ?? "");
  const [notes, setNotes] = useState<string>(quote?.notes ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const onPickFiles = (filesList: FileList | null) => {
    if (!filesList) return;
    const arr = Array.from(filesList);
    for (const f of arr) {
      if (f.size > QUOTE_MAX_FILE_SIZE) {
        toast.error(`${f.name} is larger than 20 MB`);
        return;
      }
    }
    setPendingFiles((prev) => [...prev, ...arr]);
  };

  const removePending = (idx: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setBusy(true);
    try {
      const numericAmount =
        amount.trim() === "" ? null : Number(amount);
      if (numericAmount != null && !Number.isFinite(numericAmount)) {
        throw new Error("Amount must be a number");
      }

      if (isEdit && quote) {
        await updateProjectVendorQuote({
          id: quote.id,
          quote_text: text.trim() || null,
          quote_amount: numericAmount,
          notes: notes.trim() || null,
          status: quote.status === "received" && (text || numericAmount != null) ? "revised" : quote.status,
        });
        if (pendingFiles.length > 0) {
          await uploadQuoteFiles(projectId, quote.id, pendingFiles);
        }
      } else {
        await createProjectVendorQuote(
          {
            project_id: projectId,
            vendor_id: vendorId,
            category: vendorCategory,
            quote_text: text.trim() || null,
            quote_amount: numericAmount,
            notes: notes.trim() || null,
          },
          pendingFiles,
        );
      }
      toast.success(isEdit ? "Quote updated" : "Quote added");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--terracotta)]/40 bg-white p-3 shadow-sm">
      <div className="mb-2 text-xs font-semibold text-[var(--charcoal)]">
        {isEdit ? "Edit quote" : "New quote"}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-[var(--charcoal)]/70">Amount (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder="e.g. 450000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-[var(--charcoal)]/70">Quote text</span>
          <textarea
            rows={3}
            className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder="Paste vendor's quote text or summary"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-[var(--charcoal)]/70">Internal notes</span>
          <input
            className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder="Optional notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-xs font-medium text-[var(--charcoal)]/70">Quote files (PDF / image / doc)</div>

        {isEdit && quote && quote.files.length > 0 && (
          <ul className="mb-2 space-y-1">
            {quote.files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--cream)]/60 px-2.5 py-1.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onViewFile?.(f)}
                  className="flex min-w-0 items-center gap-1.5 text-left hover:text-[var(--terracotta)]"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                  <span className="truncate">{f.file_name}</span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-[var(--charcoal)]/55">
                    {formatFileSize(f.size_bytes)}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirmDelete({
                        title: `Remove ${f.file_name}?`,
                        description: "This file will be permanently removed from the quote.",
                        confirmLabel: "Remove file",
                      });
                      if (!ok) return;
                      try {
                        await deleteQuoteFile(f);
                        toast.success("File removed");
                        onSaved();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pendingFiles.length > 0 && (
          <ul className="mb-2 space-y-1">
            {pendingFiles.map((f, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 rounded-md border border-dashed border-[var(--terracotta)]/50 bg-[var(--terracotta-soft)] px-2.5 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                  <span className="truncate">{f.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-[var(--charcoal)]/55">
                    {formatFileSize(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePending(idx)}
                    className="rounded p-1 text-[var(--charcoal)]/60 hover:bg-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-xs text-[var(--charcoal)]/70 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]">
          <Upload className="h-3.5 w-3.5" />
          {pendingFiles.length > 0 ? "Add more files" : "Attach files"}
          <input
            type="file"
            multiple
            accept={QUOTE_ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-[10px] text-[var(--charcoal)]/50">
          PDF, Word, Excel, JPG, PNG, WEBP — max 20 MB each
        </p>
      </div>

      <div className="mt-3 flex justify-end gap-2 border-t border-[var(--border)] pt-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-xs hover:bg-[var(--cream-deep)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEdit ? "Save changes" : "Add quote"}
        </button>
      </div>
    </div>
  );
}
