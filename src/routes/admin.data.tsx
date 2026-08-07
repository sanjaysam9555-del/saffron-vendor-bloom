import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileJson, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { AdminSectionBackBar } from "@/components/admin/AdminSectionBackBar";
import { SectionCard } from "@/routes/admin.users";
import { useVendors, useVendorMutations } from "@/hooks/useVendorData";
import { listProjectsOverview, bulkInsertProjectsServer } from "@/lib/projects.functions";
import { exportAllDataServer } from "@/lib/data-management.functions";
import { downloadTextFile } from "@/lib/project-csv";
import { notifyError, notifySuccess } from "@/lib/ui/feedback";

const VendorImportExportDialog = lazy(() =>
  import("@/components/vendor/VendorImportExportDialog").then((m) => ({ default: m.VendorImportExportDialog })),
);
const ProjectImportExportDialog = lazy(() =>
  import("@/components/admin/ProjectImportExportDialog").then((m) => ({ default: m.ProjectImportExportDialog })),
);

export const Route = createFileRoute("/admin/data")({
  head: () => ({
    meta: [
      { title: "Data Management — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <DataManagementPage />
    </AuthGate>
  ),
});

function DataManagementPage() {
  const { data: vendors = [] } = useVendors();
  const { bulkInsert: bulkInsertVendors } = useVendorMutations();
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjectsOverview(),
  });

  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const dump = await exportAllDataServer();
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(`saffron-full-export-${date}.json`, JSON.stringify(dump, null, 2), "application/json;charset=utf-8;");
      notifySuccess("Export ready", { description: `${Object.keys(dump.tables).length} tables downloaded.` });
    } catch (err) {
      notifyError(err, "Export failed");
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-16">
      <AdminSectionBackBar />

      <div className="hidden h-14 border-b border-[var(--border)]/60 bg-[var(--cream)]/70 sm:block">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 h-full px-3 sm:px-6">
          <span className="text-sm text-[var(--charcoal)]/70">Move vendors and projects in and out of the studio, or take everything with you.</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-6 hidden sm:block">
          <h1 className="brand-line font-display text-xl font-semibold text-[var(--charcoal)] sm:text-2xl">
            Data Management
          </h1>
        </div>

        <div className="space-y-6">
          <SectionCard
            icon={<FileSpreadsheet className="h-4 w-4" />}
            title="Vendor Import / Export"
            description="Bring vendors in from a spreadsheet, or download the full library as CSV."
            meta={`${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`}
            action={
              <button
                onClick={() => setVendorDialogOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
              >
                <FileSpreadsheet className="h-4 w-4" /> Import / Export
              </button>
            }
          >
            <p className="px-4 py-4 text-sm text-[var(--charcoal)]/78 sm:px-5">
              Import is guided — download a template, fill it in, and preview every row before anything is saved.
              Export includes every field on each vendor's profile.
            </p>
          </SectionCard>

          <SectionCard
            icon={<FileSpreadsheet className="h-4 w-4" />}
            title="Project Import / Export"
            description="Bring projects in from a spreadsheet, or download the project list as CSV."
            meta={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
            action={
              <button
                onClick={() => setProjectDialogOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90"
              >
                <FileSpreadsheet className="h-4 w-4" /> Import / Export
              </button>
            }
          >
            <p className="px-4 py-4 text-sm text-[var(--charcoal)]/78 sm:px-5">
              Each imported row creates a new project with its planning-fee instalments already set up, exactly like
              creating one by hand. Vendors, quotes, and guests aren't part of this — assign those after import.
            </p>
          </SectionCard>

          <SectionCard
            icon={<FileJson className="h-4 w-4" />}
            title="Export All Data"
            description="Every table in the studio's database, bundled into one file."
            action={
              <button
                onClick={handleExportAll}
                disabled={exportingAll}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-1.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[var(--terracotta)]/90 disabled:opacity-50"
              >
                {exportingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download everything
              </button>
            }
          >
            <p className="px-4 py-4 text-sm text-[var(--charcoal)]/78 sm:px-5">
              A single JSON file covering every vendor, project, quote, payment, and behind-the-scenes record — readable
              in any text editor. For a snapshot you can restore later, use Backup &amp; Restore instead.
            </p>
          </SectionCard>
        </div>
      </div>

      {vendorDialogOpen && (
        <Suspense fallback={null}>
          <VendorImportExportDialog
            open={vendorDialogOpen}
            vendors={vendors}
            onClose={() => setVendorDialogOpen(false)}
            onImport={async (rows) => {
              const count = await bulkInsertVendors.mutateAsync(rows);
              toast.success(`Imported ${count} vendor${count === 1 ? "" : "s"}`);
              return count;
            }}
          />
        </Suspense>
      )}

      {projectDialogOpen && (
        <Suspense fallback={null}>
          <ProjectImportExportDialog
            open={projectDialogOpen}
            projects={projects as any}
            onClose={() => setProjectDialogOpen(false)}
            onImport={async (rows) => {
              const count = await bulkInsertProjectsServer({ data: { rows } });
              toast.success(`Imported ${count} project${count === 1 ? "" : "s"}`);
              await qc.invalidateQueries({ queryKey: ["projects"] });
              return count;
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
