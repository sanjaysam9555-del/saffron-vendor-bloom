import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import {
  listProjects,
  assignVendorToProject,
  unassignVendorFromProject,
  listVendorProjectAssignments,
} from "@/server/projects.functions";

interface Props {
  vendorId: string;
  compact?: boolean;
}

export function VendorProjectAssigner({ vendorId, compact = false }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  // `projects` is only needed when the picker dialog is open. Lazy-load it
  // to avoid hitting the backend until the user actually wants to assign.
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
    enabled: open,
    staleTime: 60_000,
  });

  // Assignments power the chips shown on the vendor card itself, so this has
  // to load on mount — but the same query key is shared across every card so
  // React Query dedupes it to one network call. Long stale time prevents
  // refetch storms when the iPhone PWA regains focus.
  const { data: assignments = {} } = useQuery({
    queryKey: ["vendor-project-assignments"],
    queryFn: () => listVendorProjectAssignments(),
    staleTime: 5 * 60_000,
  });

  const projectList = Array.isArray(projects) ? projects : [];

  const assigned = (assignments as Record<string, any[]>)[vendorId] ?? [];
  const assignedIds = new Set(assigned.map((p) => p.id));

  const filteredProjects = projectList.filter((p) => {
    if (!q) return true;
    const hay = `${p.bride_name} ${p.groom_name}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ project_id, currentlyAssigned }: { project_id: string; currentlyAssigned: boolean }) => {
      if (currentlyAssigned) {
        await unassignVendorFromProject({ data: { project_id, vendor_id: vendorId } });
      } else {
        await assignVendorToProject({ data: { project_id, vendor_id: vendorId } });
      }
      return { project_id, currentlyAssigned };
    },
    onMutate: async ({ project_id, currentlyAssigned }) => {
      await qc.cancelQueries({ queryKey: ["vendor-project-assignments"] });
      const previous = qc.getQueryData(["vendor-project-assignments"]);
      const project = projectList.find((p) => p.id === project_id);
      qc.setQueryData(["vendor-project-assignments"], (old: any) => {
        const next: Record<string, any[]> = { ...(old ?? {}) };
        const list = next[vendorId] ? [...next[vendorId]] : [];
        if (currentlyAssigned) {
          next[vendorId] = list.filter((p) => p.id !== project_id);
        } else if (project) {
          next[vendorId] = [...list, project];
        }
        return next;
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["vendor-project-assignments"], ctx.previous);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["vendor-project-assignments"] });
      if (vars) qc.invalidateQueries({ queryKey: ["project", vars.project_id] });
    },
  });

  const toggle = (project_id: string, currentlyAssigned: boolean, closeAfter: boolean) => {
    toggleMutation.mutate({ project_id, currentlyAssigned });
    if (closeAfter) {
      setOpen(false);
      setQ("");
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1">
        {assigned.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--terracotta-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--terracotta)]"
            title={`${p.bride_name} & ${p.groom_name}`}
          >
            {p.bride_name} &amp; {p.groom_name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle(p.id, true, false);
              }}
              className="rounded-full p-0.5 hover:bg-white/50"
              title="Remove from project"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/65 hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
        >
          <Briefcase className="h-2.5 w-2.5" />
          {compact ? "+ Project" : "Assign to project"}
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-sm bg-black/50" />
          <DialogPrimitive.Content
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
              "flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden",
              "rounded-xl border border-[var(--border)] bg-white shadow-2xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <DialogHeader className="border-b border-[var(--border)] px-4 py-3">
              <DialogTitle className="font-display text-base text-[var(--charcoal)]">
                Assign to project
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-[var(--charcoal)]/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search projects…"
                className="w-full bg-transparent text-sm focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {filteredProjects.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-[var(--charcoal)]/55">
                  {projectList.length === 0 ? "No projects yet — create one in Projects." : "No matches."}
                </div>
              ) : (
                filteredProjects.map((p: any) => {
                  const isOn = assignedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id, isOn, true)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-[var(--cream)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--charcoal)]">
                          {p.bride_name} &amp; {p.groom_name}
                        </div>
                        <div className="text-[11px] text-[var(--charcoal)]/55">
                          {new Date(p.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      {isOn && <Check className="h-4 w-4 shrink-0 text-[var(--terracotta)]" />}
                    </button>
                  );
                })
              )}
            </div>

            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-[var(--charcoal)]/50 hover:bg-[var(--cream)] hover:text-[var(--charcoal)]">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
