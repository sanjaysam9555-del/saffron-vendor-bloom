import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MessageSquare, Loader2 } from "lucide-react";
import {
  fetchVendorComments,
  postVendorComment,
  removeVendorComment,
} from "@/lib/comments-api";

interface Props {
  projectId: string;
  vendorId: string;
  /** When true, the textarea is hidden and delete is allowed for any comment (admin view). */
  readOnly?: boolean;
  adminCanDelete?: boolean;
}

export function VendorCommentsThread({ projectId, vendorId, readOnly = false, adminCanDelete = false }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["vendor-comments", projectId, vendorId],
    queryFn: () => fetchVendorComments(projectId, vendorId),
  });

  const post = useMutation({
    mutationFn: (text: string) => postVendorComment(vendorId, text),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["vendor-comments", projectId, vendorId] });
      qc.invalidateQueries({ queryKey: ["my-project"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => removeVendorComment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-comments", projectId, vendorId] });
      qc.invalidateQueries({ queryKey: ["my-project"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || post.isPending) return;
    post.mutate(trimmed);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/55">
        <MessageSquare className="h-3 w-3" /> Comments ({comments.length})
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--charcoal)]/55">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/40 px-3 py-3 text-xs text-[var(--charcoal)]/55">
          {readOnly ? "No comments yet from the client." : "No comments yet. Add the first one below."}
        </div>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => {
            const canDelete = adminCanDelete || (!readOnly && c.is_own);
            return (
              <li
                key={c.id}
                className="rounded-md border border-[var(--border)] bg-white p-2.5 text-sm"
              >
                <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px] text-[var(--charcoal)]/60">
                  <span className="font-medium text-[var(--charcoal)]/80">
                    {c.author_name}
                    {c.author_email ? ` · ${c.author_email}` : ""}
                  </span>
                  <span>{new Date(c.created_at).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-[var(--charcoal)]/90">{c.body}</p>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this comment?")) del.mutate(c.id);
                      }}
                      className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <form onSubmit={submit} className="space-y-1.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment for the team…"
            rows={3}
            maxLength={4000}
            className="w-full resize-y rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none"
          />
          {post.isError && (
            <div className="text-xs text-red-600">{(post.error as Error).message}</div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--charcoal)]/45">
              These comments are visible to the Saffron team and other clients on this project.
            </span>
            <button
              type="submit"
              disabled={!body.trim() || post.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {post.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Post comment
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
