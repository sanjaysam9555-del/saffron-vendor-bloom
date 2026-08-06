import { supabase } from "@/integrations/supabase/client";
import type {
  ProjectVendorQuote,
  QuoteFile,
  QuoteStatus,
  VendorBookedSummary,
} from "./quote-types";
import { getQuoteFileSignedUrl, getQuoteFileStreamUrl } from "@/lib/quote-files.functions";

const BUCKET = "vendor-files";

/**
 * Explicit column list. Commission-related columns
 * (total_commission_installments, commission_remarks) are intentionally
 * excluded — they are not readable by the Data API role and must never
 * reach a client user.
 */
const QUOTE_COLUMNS =
  "id, project_id, vendor_id, category, quote_text, quote_amount, currency, status, is_final, closed_amount, notes, created_by, created_at, updated_at";

export const QUOTE_ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";
export const QUOTE_MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function listProjectVendorQuotes(
  projectId: string,
  vendorId: string,
): Promise<ProjectVendorQuote[]> {
  const { data, error } = await supabase
    .from("project_vendor_quotes")
    .select(`${QUOTE_COLUMNS}, files:project_vendor_quote_files(*)`)
    .eq("project_id", projectId)
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((q) => ({
    ...q,
    files: (q.files ?? []).sort((a: QuoteFile, b: QuoteFile) =>
      a.created_at < b.created_at ? -1 : 1,
    ),
  })) as ProjectVendorQuote[];
}

export interface ProjectVendorQuoteWithVendor extends ProjectVendorQuote {
  vendor_name: string;
}

/**
 * Every quote across every vendor on a project, in one call — backs the
 * project-level Quotes tab. Grouped by vendor there; this just returns the
 * flat list with the vendor name attached so the UI doesn't need a second
 * round trip per vendor.
 */
export async function listProjectQuotesAllVendors(
  projectId: string,
): Promise<ProjectVendorQuoteWithVendor[]> {
  const { data, error } = await supabase
    .from("project_vendor_quotes")
    .select(`${QUOTE_COLUMNS}, files:project_vendor_quote_files(*)`)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const vendorIds = Array.from(new Set(rows.map((r) => r.vendor_id)));
  let nameMap = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vendorsData } = await supabase
      .from("vendors")
      .select("id, vendor_name")
      .in("id", vendorIds);
    nameMap = new Map((vendorsData ?? []).map((v) => [v.id, v.vendor_name]));
  }
  return rows.map((q) => ({
    ...q,
    vendor_name: nameMap.get(q.vendor_id) ?? "Vendor",
    files: (q.files ?? []).sort((a: QuoteFile, b: QuoteFile) => (a.created_at < b.created_at ? -1 : 1)),
  })) as ProjectVendorQuoteWithVendor[];
}

export async function listVendorQuoteHistory(
  vendorId: string,
): Promise<ProjectVendorQuote[]> {
  const { data, error } = await supabase
    .from("project_vendor_quotes")
    .select(`${QUOTE_COLUMNS}, files:project_vendor_quote_files(*)`)
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectVendorQuote[];
}

export async function getVendorBookedSummary(
  vendorIds: string[],
): Promise<Record<string, VendorBookedSummary>> {
  if (vendorIds.length === 0) return {};
  const { data, error } = await supabase
    .from("vendor_booked_summary")
    .select("*")
    .in("vendor_id", vendorIds);
  if (error) throw error;
  const map: Record<string, VendorBookedSummary> = {};
  for (const row of (data ?? []) as VendorBookedSummary[]) {
    map[row.vendor_id] = row;
  }
  return map;
}

export async function getLatestProjectVendorQuote(
  projectId: string,
  vendorId: string,
): Promise<ProjectVendorQuote | null> {
  const all = await listProjectVendorQuotes(projectId, vendorId);
  if (all.length === 0) return null;
  // Prefer closed/is_final, else newest.
  const closed = all.find((q) => q.is_final || q.status === "closed");
  return closed ?? all[0];
}

export interface CreateQuoteInput {
  project_id: string;
  vendor_id: string;
  category?: string | null;
  quote_text?: string | null;
  quote_amount?: number | null;
  status?: QuoteStatus;
  notes?: string | null;
}

export async function createProjectVendorQuote(
  input: CreateQuoteInput,
  files: File[] = [],
): Promise<ProjectVendorQuote> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const { data: quote, error } = await supabase
    .from("project_vendor_quotes")
    .insert({
      project_id: input.project_id,
      vendor_id: input.vendor_id,
      category: input.category ?? null,
      quote_text: input.quote_text ?? null,
      quote_amount: input.quote_amount ?? null,
      status: input.status ?? "received",
      notes: input.notes ?? null,
      created_by: userId,
    })
    .select(QUOTE_COLUMNS)
    .single();
  if (error) throw error;

  if (files.length > 0) {
    await uploadQuoteFiles(input.project_id, quote.id, files);
  }

  return { ...(quote as any), files: [] };
}

export interface UpdateQuoteInput {
  id: string;
  quote_text?: string | null;
  quote_amount?: number | null;
  notes?: string | null;
  status?: QuoteStatus;
  closed_amount?: number | null;
}

export async function updateProjectVendorQuote(
  input: UpdateQuoteInput,
): Promise<void> {
  const patch: {
    quote_text?: string | null;
    quote_amount?: number | null;
    notes?: string | null;
    status?: QuoteStatus;
    closed_amount?: number | null;
  } = {};
  if ("quote_text" in input) patch.quote_text = input.quote_text;
  if ("quote_amount" in input) patch.quote_amount = input.quote_amount;
  if ("notes" in input) patch.notes = input.notes;
  if ("status" in input) patch.status = input.status;
  if ("closed_amount" in input) patch.closed_amount = input.closed_amount;
  const { error } = await supabase
    .from("project_vendor_quotes")
    .update(patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function closeProjectVendorQuote(
  id: string,
  closedAmount: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("project_vendor_quotes")
    .update({
      status: "closed",
      is_final: true,
      closed_amount: closedAmount,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProjectVendorQuote(
  quote: ProjectVendorQuote,
): Promise<void> {
  // Best-effort: remove storage files first
  if (quote.files && quote.files.length > 0) {
    const paths = quote.files.map((f) => f.file_path);
    await supabase.storage.from(BUCKET).remove(paths);
  }
  const { error } = await supabase
    .from("project_vendor_quotes")
    .delete()
    .eq("id", quote.id);
  if (error) throw error;
}

export async function uploadQuoteFiles(
  projectId: string,
  quoteId: string,
  files: File[],
): Promise<QuoteFile[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const results: QuoteFile[] = [];
  for (const file of files) {
    if (file.size > QUOTE_MAX_FILE_SIZE) {
      throw new Error(`${file.name} is larger than 20 MB`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `quotes/${projectId}/${quoteId}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
    if (upErr) throw upErr;

    const { data, error } = await supabase
      .from("project_vendor_quote_files")
      .insert({
        quote_id: quoteId,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
    results.push(data as QuoteFile);
  }
  return results;
}

export async function deleteQuoteFile(file: QuoteFile): Promise<void> {
  await supabase.storage.from(BUCKET).remove([file.file_path]);
  const { error } = await supabase
    .from("project_vendor_quote_files")
    .delete()
    .eq("id", file.id);
  if (error) throw error;
}

export async function getQuoteFileUrl(filePath: string): Promise<string> {
  const { url } = await getQuoteFileSignedUrl({ data: { file_path: filePath } });
  return url;
}

export async function getQuoteFileStreamUrlClient(filePath: string): Promise<string> {
  const { url } = await getQuoteFileStreamUrl({ data: { file_path: filePath } });
  return url;
}
