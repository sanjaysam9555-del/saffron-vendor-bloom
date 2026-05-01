import { Loader2, Pencil, Trash2, X, CheckSquare } from "lucide-react";
import { useState } from "react";

interface BulkActionBarProps {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onEditFields: () => void;
  onDelete: () => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export function BulkActionBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  onSelectAllVisible,
  onClearSelection,
  onEditFields,
  onDelete,
  onCancel,
  busy = false,
}: BulkActionBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm animate-fade-up">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 items-center rounded-full bg-[var(--terracotta-soft)] px-3 text-sm font-medium text-[var(--terracotta)]">
            {selectedCount} selected
          </span>
          {visibleCount > 0 && (
            <button
              onClick={onSelectAllVisible}
              disabled={busy || deleting}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:opacity-50"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {allVisibleSelected ? "Deselect all visible" : `Select all visible (${visibleCount})`}
            </button>
          )}
          {selectedCount > 0 && (
            <button
              onClick={onClearSelection}
              disabled={busy || deleting}
              className="text-xs text-[var(--charcoal)]/55 underline-offset-2 hover:text-[var(--terracotta)] hover:underline disabled:opacity-50"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {confirmDelete && (
            <span className="text-xs text-red-700">
              Delete {selectedCount} vendor{selectedCount === 1 ? "" : "s"}? This can't be undone.
            </span>
          )}
          <button
            onClick={onEditFields}
            disabled={selectedCount === 0 || busy || deleting}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--charcoal)] hover:border-[var(--terracotta)] hover:text-[var(--terracotta)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" /> Edit fields
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedCount === 0 || busy || deleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {confirmDelete ? "Confirm delete" : "Delete"}
          </button>
          {confirmDelete && !deleting && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-md px-2 py-2 text-xs text-[var(--charcoal)]/55 hover:text-[var(--charcoal)]"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onCancel}
            disabled={busy || deleting}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-[var(--charcoal)]/60 hover:bg-[var(--cream-deep)] disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Exit bulk mode
          </button>
        </div>
      </div>
    </div>
  );
}
