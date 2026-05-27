import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { ClientPreviewProvider } from "@/lib/client-preview";
import { getProjectAsClientView } from "@/server/projects.functions";
import { ClientVendorCard } from "@/components/client/ClientVendorCard";
import { useInstagramPreviewsBulk, useAutoEnsureMissingPreviews } from "@/hooks/use-instagram-previews";
import type { ClientVendor } from "@/lib/project-types";

const ClientVendorDetail = lazy(() =>
  import("@/components/client/ClientVendorDetail").then((m) => ({ default: m.ClientVendorDetail })),
);

export const Route = createFileRoute("/admin/projects/$id/preview/$clientId")({
  head: () => ({
    meta: [
      { title: "Client preview — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AuthGate>
      <PreviewPage />
    </AuthGate>
  ),
});

function PreviewPage() {
  const { id, clientId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-project-preview", id, clientId],
    queryFn: () => getProjectAsClientView({ data: { project_id: id, client_user_id: clientId } }),
  });
  const [detail, setDetail] = useState<ClientVendor | null>(null);

  const vendors = ((data as { vendors?: ClientVendor[] } | undefined)?.vendors ?? []) as ClientVendor[];
  const igIds = useMemo(() => vendors.filter((v) => v.instagram_handle).map((v) => v.id), [vendors]);
  const { map: previewMap } = useInstagramPreviewsBulk(igIds);
  useAutoEnsureMissingPreviews(vendors, previewMap);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--cream-deep)]" />
          <div className="mt-4 h-8 w-72 animate-pulse rounded bg-[var(--cream-deep)]" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-6">
        <div className="rounded-lg bg-white p-6 text-sm text-red-700 shadow-sm">
          {error instanceof Error ? error.message : "Failed to load preview"}
        </div>
      </div>
    );
  }

  const { project } = data as { project: { id: string; bride_name: string; groom_name: string; wedding_date: string } };


  return (
    <ClientPreviewProvider clientLabel="client" projectId={id}>
      <div className="min-h-screen bg-[var(--cream)]">
        {/* Preview banner — non-sticky so it doesn't overlap the admin shell header on scroll */}
        <div className="border-b border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)] px-4 py-2 text-xs text-[var(--charcoal)] sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Eye className="h-3.5 w-3.5" />
              Viewing as client — read-only preview
            </span>
            <Link
              to="/admin/projects/$id"
              params={{ id }}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 hover:border-[var(--terracotta)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to project
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <h1 className="font-display text-2xl text-[var(--charcoal)] sm:text-3xl">
            {project.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {project.groom_name}
          </h1>
          <p className="mt-1 text-sm text-[var(--charcoal)]/65">
            {new Date(project.wedding_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>

          {vendors.length === 0 ? (
            <div className="mt-8 rounded-lg border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--charcoal)]/60">
              No vendors assigned to this project yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vendors.map((v) => (
                <ClientVendorCard
                  key={v.id}
                  vendor={v}
                  onView={() => setDetail(v)}
                  instagramPreview={previewMap.get(v.id) ?? null}
                />
              ))}
            </div>
          )}
        </div>

        <Suspense fallback={null}>
          <ClientVendorDetail vendor={detail} onClose={() => setDetail(null)} />
        </Suspense>
      </div>
    </ClientPreviewProvider>
  );
}
