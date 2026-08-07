import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, Loader2, RotateCcw, Trash2, AlertTriangle, X, PlayCircle } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AdminSectionBackBar } from "@/components/admin/AdminSectionBackBar";
import { SectionCard } from "@/routes/admin.users";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonBlock } from "@/components/ui/LoadingState";
import { notifyError, notifySuccess } from "@/lib/ui/feedback";
import {
  listBackupsServer,
  runBackupNowServer,
  getBackupDownloadUrlServer,
  deleteBackupServer,
  restoreBackupServer,
} from "@/lib/backups.functions";

export const Route = createFileRoute("/admin/backups")({
  head: () => ({
    meta: [
      { title: "Backup & Restore — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <BackupsPage />
    </AuthGate>
  ),
});

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function BackupsPage() {
  const qc = useQueryClient();
  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => listBackupsServer(),
  });
  const [running, setRunning] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<(typeof backups)[number] | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["backups"] });

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const backup = await runBackupNowServer();
      notifySuccess("Backup created", { description: backup.label });
      refresh();
    } catch (err) {
      notifyError(err, "Backup failed");
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const { url } = await getBackupDownloadUrlServer({ data: { backup_id: id } });
      window.open(url, "_blank");
    } catch (err) {
      notifyError(err, "Could not get download link");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBackupServer({ data: { backup_id: id } });
      notifySuccess("Backup deleted");
      refresh();
    } catch (err) {
      notifyError(err, "Could not delete backup");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      <AdminSectionBackBar />

      <div className="hidden h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70 sm:block">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/55">A snapshot of the whole database is taken automatically every midnight.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-6 hidden sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Backup & Restore
          </h1>
        </div>

        <div className="space-y-6">
          <SectionCard
            icon={<Archive className="h-4 w-4" />}
            title="Backups"
            description="One automatic backup every midnight (IST), labelled and stored for as long as you keep it."
            meta={isLoading ? undefined : `${backups.length} backup${backups.length === 1 ? "" : "s"}`}
            action={
              <button
                onClick={handleRunNow}
                disabled={running}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run backup now
              </button>
            }
          >
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : backups.length === 0 ? (
              <EmptyState
                compact
                icon={<Archive />}
                title="No backups yet"
                description="Run one now, or wait for tonight's automatic backup."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-[var(--charcoal)] text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/80">
                    <tr>
                      <th className="px-4 py-2.5">Label</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Size</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.id} className="border-t border-[var(--border)] transition-colors hover:bg-[var(--cream)]/60">
                        <td className="px-4 py-3 text-[var(--charcoal)]">{b.label}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${b.kind === "automatic" ? "bg-[var(--cream-deep)] text-[var(--charcoal)]/70" : "bg-[var(--terracotta-soft)] text-[var(--terracotta)]"}`}>
                            {b.kind}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--charcoal)]/60">{formatBytes(b.size_bytes)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleDownload(b.id)} title="Download" className="rounded p-1.5 text-[var(--charcoal)]/60 transition-colors hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
                              <Download className="h-4 w-4" />
                            </button>
                            <button onClick={() => setRestoreTarget(b)} title="Restore this backup" className="rounded p-1.5 text-[var(--charcoal)]/60 transition-colors hover:bg-[var(--cream)] hover:text-[var(--terracotta)]">
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(b.id)} title="Delete backup" className="rounded p-1.5 text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Before you restore"
            description="What actually happens when you restore a backup."
          >
            <p className="px-4 py-4 text-sm text-[var(--charcoal)]/65 sm:px-5">
              Restoring replaces <strong>every</strong> table with the backup's contents — anything created or changed
              since that backup is lost. A fresh safety backup is taken automatically the moment before a restore
              starts, so you can always undo a restore by restoring that one. Restore is admin-only and asks you to
              type the backup's exact label to confirm.
            </p>
          </SectionCard>
        </div>
      </div>

      {restoreTarget && (
        <RestoreConfirmDialog
          backup={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onRestored={refresh}
        />
      )}
    </div>
  );
}

function RestoreConfirmDialog({
  backup,
  onClose,
  onRestored,
}: {
  backup: { id: string; label: string; row_counts: Record<string, number> };
  onClose: () => void;
  onRestored: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed === backup.label;
  const totalRows = Object.values(backup.row_counts ?? {}).reduce((a, b) => a + b, 0);

  const handleRestore = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      await restoreBackupServer({ data: { backup_id: backup.id, confirm_label: typed } });
      notifySuccess("Restore complete", { description: "The database now matches this backup." });
      onRestored();
      onClose();
    } catch (err) {
      notifyError(err, "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-xl bg-[var(--cream)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--charcoal)]">Restore this backup?</h2>
              <p className="mt-0.5 text-xs text-[var(--charcoal)]/55">{backup.label}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-md p-1 text-[var(--charcoal)]/55 hover:bg-[var(--cream-deep)] disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-[var(--charcoal)]/75">
            This replaces every table with this snapshot (~{totalRows.toLocaleString("en-IN")} rows total). Anything
            created or changed since then will be gone. A safety backup of the current state is taken automatically
            first.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--charcoal)]/70">
              Type the backup label exactly to confirm:
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={backup.label}
              disabled={busy}
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-white px-5 py-3">
          <button onClick={onClose} disabled={busy} className="rounded-md border border-[var(--border)] px-3.5 py-1.5 text-sm text-[var(--charcoal)]/75 hover:border-[var(--terracotta)] disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={!matches || busy}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Restore now
          </button>
        </div>
      </div>
    </div>
  );
}
