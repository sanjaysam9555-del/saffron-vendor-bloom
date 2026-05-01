import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, Search, X } from "lucide-react";
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

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const { data: assignments = {} } = useQuery({
    queryKey: ["vendor-project-assignments"],
    queryFn: () => listVendorProjectAssignments(),
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
    <div className="relative" onClick={(e) => e.stopPropagation()}>
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

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-[var(--border)] bg-white shadow-lg">
          <div className="flex items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
            <Search className="h-3 w-3 text-[var(--charcoal)]/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-transparent text-xs focus:outline-none"
              autoFocus
            />
            <button onClick={() => setOpen(false)} className="text-[var(--charcoal)]/40 hover:text-[var(--charcoal)]">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredProjects.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--charcoal)]/55">
                {projectList.length === 0 ? "No projects yet — create one in Projects." : "No matches."}
              </div>
            ) : (
              filteredProjects.map((p: any) => {
                const isOn = assignedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id, isOn, true)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-[var(--cream)]"
                  >
                    <div>
                      <div className="font-medium text-[var(--charcoal)]">
                        {p.bride_name} &amp; {p.groom_name}
                      </div>
                      <div className="text-[10px] text-[var(--charcoal)]/55">
                        {new Date(p.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    {isOn && <Check className="h-3.5 w-3.5 text-[var(--terracotta)]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
