import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MessageSquare, Loader2, Reply, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  fetchVendorComments,
  postClientVendorComment,
  postStaffVendorComment,
  removeVendorComment,
  type VendorComment,
} from "@/lib/comments-api";
import { useConfirmDelete } from "@/components/ui/confirm-dialog";
import { notifySuccess, notifyError } from "@/lib/ui/feedback";
import { useClientPreview } from "@/lib/client-preview";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface Props {
  projectId: string;
  vendorId: string;
  /** When true, posts via the staff endpoint (admin view). */
  asStaff?: boolean;
  /** Admins can delete any comment. */
  adminCanDelete?: boolean;
}

export function VendorCommentsThread({ projectId, vendorId, asStaff = false, adminCanDelete = false }: Props) {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const { isPreview } = useClientPreview();
  const reduced = useReducedMotion();
  const canPost = !isPreview; // preview never posts
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<VendorComment | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["vendor-comments", projectId, vendorId],
    queryFn: () => fetchVendorComments(projectId, vendorId),
  });

  // Track which comment IDs have been seen across renders so freshly
  // arriving ones can briefly highlight.
  const seenIds = useRef<Set<string> | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!seenIds.current) {
      // First load — mark everything as seen, nothing highlights.
      seenIds.current = new Set(comments.map((c) => c.id));
      return;
    }
    const fresh = comments.filter((c) => !seenIds.current!.has(c.id)).map((c) => c.id);
    if (fresh.length === 0) return;
    fresh.forEach((id) => seenIds.current!.add(id));
    setHighlightIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((id) => next.add(id));
      return next;
    });
    const t = window.setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev);
        fresh.forEach((id) => next.delete(id));
        return next;
      });
    }, 1600);
    return () => window.clearTimeout(t);
  }, [comments]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vendor-comments", projectId, vendorId] });
    qc.invalidateQueries({ queryKey: ["my-project"] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const post = useMutation({
    mutationFn: async ({ text, parentId }: { text: string; parentId: string | null }) => {
      if (asStaff) return postStaffVendorComment(projectId, vendorId, text, parentId);
      return postClientVendorComment(vendorId, text, parentId);
    },
    onSuccess: () => {
      notifySuccess(replyTo ? "Reply posted" : "Comment posted");
      setBody("");
      setReplyTo(null);
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not post comment"),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeVendorComment(id),
    onSuccess: () => {
      notifySuccess("Comment deleted");
      invalidate();
    },
    onError: (e) => notifyError(e, "Could not delete comment"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || post.isPending) return;
    post.mutate({ text: trimmed, parentId: replyTo?.id ?? null });
  };

  // Group replies under their parents (single level)
  const { roots, repliesByParent } = useMemo(() => {
    const r: VendorComment[] = [];
    const byParent = new Map<string, VendorComment[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const list = byParent.get(c.parent_id) ?? [];
        list.push(c);
        byParent.set(c.parent_id, list);
      } else {
        r.push(c);
      }
    }
    // Orphan replies (parent deleted) — promote to roots
    for (const c of comments) {
      if (c.parent_id && !comments.some((x) => x.id === c.parent_id)) {
        r.push(c);
      }
    }
    return { roots: r, repliesByParent: byParent };
  }, [comments]);

  // Root comments are wrapped by their own outer <li> below (so a <ul> of
  // replies can nest inside it alongside the comment body); replies sit
  // directly inside that nested <ul>. Rendering both as <li> produced
  // <li><li>...</li></li> with no <ul> between them — invalid HTML and a
  // hydration-mismatch warning. `asDiv` picks the right tag for each case
  // while keeping every motion/AnimatePresence prop identical.
  const renderComment = (c: VendorComment, isReply = false, asDiv = false) => {
    const canDelete =
      (adminCanDelete && !isPreview) ||
      (!isPreview && c.is_own);
    const isStaff = c.author_role === "staff";
    const isNew = highlightIds.has(c.id);
    const MotionTag = asDiv ? motion.div : motion.li;
    return (
      <MotionTag
        key={c.id}
        layout={!reduced}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className={`rounded-md border p-2.5 text-sm transition-shadow ${
          isStaff
            ? "border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)]/40"
            : "border-[var(--border)] bg-white"
        } ${isNew ? "animate-ring-flash ring-1 ring-[var(--terracotta)]/40" : ""}`}
      >
        <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px] text-[var(--charcoal)]/74">
          <span className="inline-flex items-center gap-1 font-medium text-[var(--charcoal)]/80">
            {isStaff && <Sparkles className="h-3 w-3 text-[var(--terracotta)]" />}
            <span className={isStaff ? "text-[var(--terracotta)]" : ""}>{c.author_name}</span>
            {c.author_email ? <span className="opacity-70"> · {c.author_email}</span> : null}
          </span>
          <span>{new Date(c.created_at).toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap text-[var(--charcoal)]/90">{c.body}</p>
          <div className="flex shrink-0 items-center gap-1">
            {canPost && !isReply && (
              <button
                type="button"
                onClick={() => setReplyTo(c)}
                className="rounded p-1 text-[var(--charcoal)]/70 hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"
                title="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDelete({
                    title: "Delete this comment?",
                    description: "This cannot be undone.",
                  });
                  if (ok) del.mutate(c.id);
                }}
                className="rounded p-1 text-red-600 hover:bg-red-50"
                title="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </MotionTag>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--charcoal)]/70">
        <MessageSquare className="h-3 w-3" /> Comments ({comments.length})
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--charcoal)]/70">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--cream)]/40 px-3 py-3 text-xs text-[var(--charcoal)]/70">
          No comments yet. {canPost ? "Add the first one below." : ""}
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {roots.map((c) => (
              <li key={c.id} className="space-y-2">
                {renderComment(c, false, true)}
                {(repliesByParent.get(c.id) ?? []).length > 0 && (
                  <ul className="ml-5 space-y-2 border-l-2 border-[var(--terracotta)]/20 pl-3">
                    <AnimatePresence initial={false}>
                      {(repliesByParent.get(c.id) ?? []).map((r) => renderComment(r, true))}
                    </AnimatePresence>
                  </ul>
                )}
              </li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {canPost && (
        <form onSubmit={submit} className="space-y-1.5">
          {replyTo && (
            <div className="flex items-center justify-between rounded-md border border-[var(--terracotta)]/30 bg-[var(--terracotta-soft)]/40 px-2 py-1 text-[11px] text-[var(--charcoal)]/75">
              <span>
                Replying to <span className="font-medium">{replyTo.author_name}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-[var(--terracotta)] hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              replyTo
                ? `Reply to ${replyTo.author_name}…`
                : asStaff
                  ? "Write a comment for the client…"
                  : "Write a comment for the team…"
            }
            rows={3}
            maxLength={4000}
            className="w-full resize-y rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-[var(--terracotta)] focus:outline-none"
          />
          {post.isError && (
            <div className="text-xs text-red-600">{(post.error as Error).message}</div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--charcoal)]/62">
              {asStaff
                ? "Visible to the client and the Saffron team."
                : "Visible to the Saffron team and other clients on this project."}
            </span>
            <button
              type="submit"
              disabled={!body.trim() || post.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {post.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {replyTo ? "Post reply" : "Post comment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
