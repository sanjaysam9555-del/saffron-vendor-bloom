import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Phone, Mail, Instagram, ExternalLink, ArrowRight, Check } from "lucide-react";

import { TopNav } from "@/components/vendor/TopNav";
import { VendorForm } from "@/components/vendor/VendorForm";
import { listLeads, updateLeadStatus } from "@/lib/vendor-api";
import { useVendors, useVendorMutations, useVendorModals } from "@/hooks/useVendorData";
import { CATEGORIES } from "@/lib/categories";
import type { InboundLead } from "@/lib/vendor-types";
import type { VendorInput } from "@/lib/vendor-types";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Inbound Leads — Saffron Events" },
      { name: "description", content: "Vendor inquiries from inbound forms — review and convert into your vendor book." },
    ],
  }),
  component: LeadsPage,
});

function leadToVendorPrefill(l: InboundLead): Partial<VendorInput> {
  return {
    vendor_name: l.name,
    location: l.location,
    contact_number: l.contact,
    email: l.email,
    instagram_handle: l.instagram?.replace(/^@/, "") ?? null,
    portfolio_link: l.portfolio,
    subcategory: l.services,
    source: "Inbound Form",
    tags: [],
  };
}

function LeadsPage() {
  const qc = useQueryClient();
  const { data: vendors = [] } = useVendors();
  const { create } = useVendorMutations();
  const modals = useVendorModals();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"], queryFn: listLeads,
  });

  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const markConverted = useMutation({
    mutationFn: (id: string) => updateLeadStatus(id, "converted"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (keyword && !(l.services ?? "").toLowerCase().includes(keyword.toLowerCase())) return false;
      if (from && new Date(l.submitted_at) < new Date(from)) return false;
      if (to && new Date(l.submitted_at) > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [leads, keyword, from, to]);

  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <TopNav
        search={search}
        onSearchChange={setSearch}
        onAddVendor={() => modals.openCreate()}
        totalVendors={vendors.length}
        totalCategories={CATEGORIES.length}
      />

      <main className="mx-auto max-w-[1600px] p-6">
        <div className="mb-6 flex items-center gap-3">
          <Inbox className="h-7 w-7 text-[var(--terracotta)]" />
          <div>
            <h1 className="font-display text-3xl text-[var(--charcoal)]">Inbound Leads</h1>
            <p className="text-sm text-[var(--charcoal)]/55">Form submissions waiting to be qualified.</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-white p-3">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/50">Search Services</div>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. photography, decor"
              className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm text-[var(--charcoal)] placeholder:text-[var(--charcoal)]/50 focus:border-[var(--terracotta)] focus:outline-none"
            />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/50">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm text-[var(--charcoal)] focus:border-[var(--terracotta)] focus:outline-none" />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/50">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm text-[var(--charcoal)] focus:border-[var(--terracotta)] focus:outline-none" />
          </div>
          {(keyword || from || to) && (
            <button onClick={() => { setKeyword(""); setFrom(""); setTo(""); }} className="text-xs text-[var(--charcoal)]/55 hover:text-[var(--charcoal)]">Clear</button>
          )}
        </div>

        {isLoading ? (
          <div className="text-[var(--charcoal)]/55">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-white py-16 text-center text-[var(--charcoal)]/55">
            No inbound leads match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-white">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Services</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Portfolio</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border)] align-top hover:bg-white/[0.04]">
                    <td className="px-3 py-2 text-xs text-[var(--charcoal)]/55">{new Date(l.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-3 py-2 font-medium text-[var(--charcoal)]">{l.name}</td>
                    <td className="px-3 py-2 text-[var(--charcoal)]/75">{l.services ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--charcoal)]/75">{l.location ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--charcoal)]/75">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {l.contact && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.contact}</span>}
                        {l.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</span>}
                        {l.instagram && <span className="flex items-center gap-1"><Instagram className="h-3 w-3" />@{l.instagram.replace(/^@/, "")}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {l.portfolio ? (
                        <a href={l.portfolio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--terracotta)] hover:underline">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-[var(--charcoal)]/50">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        l.status === "converted" ? "bg-green-500/15 text-green-400"
                        : l.status === "dismissed" ? "bg-[var(--cream-deep)] text-[var(--charcoal)]/55"
                        : "bg-amber-500/15 text-amber-400"
                      }`}>{l.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l.status === "converted" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400"><Check className="h-3 w-3" /> Done</span>
                      ) : (
                        <button
                          onClick={() => {
                            setConvertingLeadId(l.id);
                            modals.openCreate(leadToVendorPrefill(l));
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--terracotta)] px-2 py-1 text-xs font-medium text-[var(--charcoal)] hover:bg-[var(--terracotta)]/90"
                        >
                          Convert <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <VendorForm
        open={modals.state.formOpen}
        initial={modals.state.prefill}
        onClose={() => { modals.closeForm(); setConvertingLeadId(null); }}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          if (convertingLeadId) {
            await markConverted.mutateAsync(convertingLeadId);
            setConvertingLeadId(null);
          }
        }}
      />
    </div>
  );
}
