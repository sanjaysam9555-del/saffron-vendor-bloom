import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Instagram, Link as LinkIcon, FileText, Paperclip } from "lucide-react";
import { ClientGate } from "@/components/ClientGate";
import { useAuth } from "@/lib/auth";
import { getMyProject } from "@/server/projects.functions";
import { getAttachmentUrl, formatFileSize } from "@/lib/vendor-files-api";

export const Route = createFileRoute("/client/")({
  head: () => ({ meta: [{ title: "Your Vendors — Saffron Events" }] }),
  component: () => (
    <ClientGate>
      <ClientPortalPage />
    </ClientGate>
  ),
});

function ClientPortalPage() {
  const { signOut } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-project"],
    queryFn: () => getMyProject(),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-sm text-[var(--charcoal)]/60">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-6">
        <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-sm">
          <h2 className="font-display text-xl text-[var(--charcoal)]">Nothing here yet</h2>
          <p className="mt-2 text-sm text-[var(--charcoal)]/60">
            {error instanceof Error ? error.message : "Your planner hasn't shared vendors with you yet."}
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--terracotta)]"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const { project, vendors } = data;
  const dateFmt = new Date(project.wedding_date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Group by category
  const grouped = vendors.reduce<Record<string, typeof vendors>>((acc, v) => {
    (acc[v.category] = acc[v.category] ?? []).push(v);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--terracotta)]">
              Saffron Events
            </div>
            <h1 className="font-display text-3xl leading-tight text-[var(--charcoal)]">
              {project.bride_name} <span className="text-[var(--terracotta)]">&amp;</span> {project.groom_name}
            </h1>
            <div className="mt-1 text-sm text-[var(--charcoal)]/60">{dateFmt}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs hover:border-[var(--terracotta)]"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <p className="mb-8 text-base text-[var(--charcoal)]/75">
          Welcome — here are the vendors we think will be perfect for you.
        </p>

        {vendors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--champagne)] bg-white py-16 text-center">
            <p className="text-sm text-[var(--charcoal)]/60">
              Your planner hasn't shared any vendors yet. Check back soon.
            </p>
          </div>
        ) : (
          categories.map((cat) => (
            <section key={cat} className="mb-10">
              <h2 className="mb-3 font-display text-xl text-[var(--charcoal)] border-b border-[var(--border)] pb-1">
                {cat}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {grouped[cat].map((v) => (
                  <div key={v.id} className="rounded-lg border border-[var(--border)] bg-white p-4">
                    {v.subcategory && (
                      <div className="mb-1 inline-flex rounded-full bg-[var(--cream-deep)] px-2 py-0.5 text-[10px] text-[var(--charcoal)]/65">
                        {v.subcategory}
                      </div>
                    )}
                    <h3 className="font-display text-lg font-semibold text-[var(--charcoal)]">
                      {v.vendor_name}
                    </h3>
                    {v.price_text && (
                      <div className="mt-1 text-sm font-medium text-[var(--terracotta)]">
                        {v.price_text}
                      </div>
                    )}
                    <div className="mt-2 space-y-1.5 text-sm">
                      {v.instagram_handle && (
                        <a
                          href={`https://instagram.com/${v.instagram_handle}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[var(--charcoal)]/75 hover:text-[var(--terracotta)]"
                        >
                          <Instagram className="h-3.5 w-3.5" /> @{v.instagram_handle}
                        </a>
                      )}
                      {v.portfolio_link && (
                        <a
                          href={v.portfolio_link.startsWith("http") ? v.portfolio_link : `https://${v.portfolio_link}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[var(--charcoal)]/75 hover:text-[var(--terracotta)]"
                        >
                          <LinkIcon className="h-3.5 w-3.5" /> Portfolio
                        </a>
                      )}
                    </div>

                    {v.attachments.length > 0 && (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
                          <Paperclip className="h-3 w-3" /> Documents
                        </div>
                        <ul className="space-y-1">
                          {v.attachments.map((att) => (
                            <li key={att.id}>
                              <a
                                href={getAttachmentUrl(att.file_path)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs hover:border-[var(--terracotta)] hover:bg-[var(--terracotta-soft)]"
                              >
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                                  <span className="truncate">{att.file_name}</span>
                                </span>
                                <span className="shrink-0 text-[var(--charcoal)]/55">
                                  {formatFileSize(att.size_bytes)}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
