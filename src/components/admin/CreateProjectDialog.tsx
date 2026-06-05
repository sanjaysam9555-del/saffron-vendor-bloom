import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createProject } from "@/lib/projects.functions";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [bride, setBride] = useState("");
  const [groom, setGroom] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setBride("");
    setGroom("");
    setDate("");
    setNotes("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const row = await createProject({
        data: {
          bride_name: bride.trim(),
          groom_name: groom.trim(),
          wedding_date: date,
          notes: notes.trim() || null,
        },
      });
      notifySuccess("Project created");
      await qc.invalidateQueries({ queryKey: ["projects"] });
      reset();
      onClose();
      if (row?.id) onCreated?.(row.id);
    } catch (e) {
      notifyError(e, "Could not create project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-[var(--cream)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--charcoal)]/55">New</div>
            <h3 className="font-display text-xl text-[var(--charcoal)]">Create a project</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--cream-deep)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--charcoal)]/70">
              Bride name
              <input required value={bride} onChange={(e) => setBride(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-[var(--charcoal)]/70">
              Groom name
              <input required value={groom} onChange={(e) => setGroom(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2 text-xs text-[var(--charcoal)]/70">
              Wedding date
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2 text-xs text-[var(--charcoal)]/70">
              Notes (optional)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-[var(--cream)]">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90 disabled:opacity-50">
              {busy ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
