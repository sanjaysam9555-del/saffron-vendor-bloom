import { useEffect, useRef, useState } from "react";
import { Instagram, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useInstagramBackfillStatus,
  useProcessInstagramBackfillBatch,
  useStartInstagramBackfill,
  type InstagramBackfillJob,
} from "@/hooks/use-instagram-previews";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkInstagramSyncDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [startedJob, setStartedJob] = useState<InstagramBackfillJob | null>(null);
  const start = useStartInstagramBackfill();
  const processBatch = useProcessInstagramBackfillBatch();
  const { data: status } = useInstagramBackfillStatus(jobId);

  const runningRef = useRef(false);
  const completedRef = useRef(false);

  // Reset when dialog closes.
  useEffect(() => {
    if (!open) {
      setJobId(null);
      setStartedJob(null);
      runningRef.current = false;
      completedRef.current = false;
    }
  }, [open]);

  // Drive the batch loop while a job is running.
  useEffect(() => {
    if (!jobId || !status) return;
    if (status.status !== "running") {
      if (!completedRef.current && status.status === "done") {
        completedRef.current = true;
        toast.success(
          `Instagram sync complete — ${status.ok} updated${status.errors > 0 ? `, ${status.errors} failed` : ""}.`,
        );
        qc.invalidateQueries({ queryKey: ["instagram-previews-bulk"] });
        qc.invalidateQueries({ queryKey: ["instagram-preview"] });
      }
      return;
    }
    if (runningRef.current) return;
    if (status.pending_count === 0) return;
    runningRef.current = true;
    processBatch
      .mutateAsync({ jobId })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Backfill batch failed");
      })
      .finally(() => {
        runningRef.current = false;
        qc.invalidateQueries({ queryKey: ["instagram-backfill-status", jobId] });
      });
  }, [jobId, status, processBatch, qc]);

  const job = status ?? startedJob;
  const total = job?.total ?? 0;
  const processed = job?.processed ?? 0;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isRunning = job?.status === "running";
  const isDone = job?.status === "done";

  const handleStart = async () => {
    try {
      const result = await start.mutateAsync({ mode: "missing_or_stale" });
      setStartedJob(result);
      setJobId(result.id);
      if (result.total === 0) {
        toast.info("No vendors need an Instagram refresh.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start backfill");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--charcoal)]">
            <Instagram className="h-4 w-4 text-[var(--terracotta)]" />
            Sync Instagram previews
          </DialogTitle>
          <DialogDescription>
            Fetches Instagram data for vendors that have no preview yet or whose preview is older than 30 days. Already-fresh vendors are skipped.
          </DialogDescription>
        </DialogHeader>

        {!job && (
          <div className="rounded-md border border-[var(--border)] bg-[var(--cream)]/40 p-3 text-sm text-[var(--charcoal)]/75">
            Click <span className="font-medium">Start backfill</span> to begin. You can close this dialog and the job will keep running in the background.
          </div>
        )}

        {job && (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--border)] bg-[var(--cream)]/40 p-3 text-sm">
              <div className="flex items-center justify-between text-[var(--charcoal)]">
                <span>
                  {processed} / {total} processed
                </span>
                <span className="font-medium">{pct}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--cream-deep)]">
                <div
                  className="h-full bg-[var(--terracotta)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--charcoal)]/70">
                <span>✓ {job.ok} ok</span>
                <span>✗ {job.errors} failed</span>
                {isRunning && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[var(--charcoal)]/55">
                    <Loader2 className="h-3 w-3 animate-spin" /> Working…
                  </span>
                )}
              </div>
            </div>
            {job.last_error && (
              <div className="truncate text-[11px] text-[var(--charcoal)]/55">
                Last error: {job.last_error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!job && (
            <Button onClick={handleStart} disabled={start.isPending}>
              {start.isPending ? "Starting…" : "Start backfill"}
            </Button>
          )}
          {job && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isDone ? "Close" : "Run in background"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
