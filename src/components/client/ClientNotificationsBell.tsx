import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyClientNotifications,
  markClientNotificationRead,
  markAllClientNotificationsRead,
} from "@/lib/client-notifications.functions";
import { useAuth } from "@/lib/auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UrgencyStrip } from "@/components/timeline/UrgencyStrip";
import { classifyUrgency, useNow, type TimelineItem, type UrgencyBucket } from "@/lib/urgency";

interface NotificationRow {
  id: string;
  kind: string;
  project_id: string | null;
  vendor_id: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

interface Props {
  attentionItems: TimelineItem[];
  onAttentionChipClick: (category: string) => void;
  onAttentionViewAll: () => void;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const ATTENTION_BUCKETS: UrgencyBucket[] = ["overdue", "urgent", "soon"];

export function ClientNotificationsBell({
  attentionItems,
  onAttentionChipClick,
  onAttentionViewAll,
}: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const now = useNow();

  const attentionCount = useMemo(
    () =>
      attentionItems.filter((it) =>
        ATTENTION_BUCKETS.includes(classifyUrgency(it, now).bucket),
      ).length,
    [attentionItems, now],
  );

  const unreadNotifs = items.filter((i) => !i.read_at).length;
  const totalBadge = unreadNotifs + attentionCount;

  const refresh = async () => {
    try {
      const rows = (await listMyClientNotifications({ data: { limit: 30 } })) as NotificationRow[];
      setItems(rows);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!userId) return;
    refresh();
    const ch = supabase
      .channel(`client_notifications_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev].slice(0, 30));
          toast.info(row.title);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const markOne = async (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, read_at: new Date().toISOString() } : it)),
    );
    try {
      await markClientNotificationRead({ data: { id } });
    } catch {}
  };

  const markAll = async () => {
    const stamp = new Date().toISOString();
    setItems((prev) => prev.map((it) => ({ ...it, read_at: it.read_at ?? stamp })));
    try {
      await markAllClientNotificationsRead({});
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--charcoal)]/82 transition hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]"
        >
          <Bell className="h-4 w-4" />
          {totalBadge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[var(--terracotta)] px-1 text-[10px] font-semibold leading-4 text-white">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] overflow-hidden p-0">
        {/* Pinned attention strip */}
        {attentionCount > 0 && (
          <div className="sticky top-0 z-10 border-b border-[var(--border)]">
            <UrgencyStrip
              items={attentionItems}
              onChipClick={(cat) => {
                setOpen(false);
                onAttentionChipClick(cat);
              }}
              onViewAll={() => {
                setOpen(false);
                onAttentionViewAll();
              }}
              maxChips={6}
            />
          </div>
        )}

        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          {unreadNotifs > 0 && (
            <button
              onClick={markAll}
              className="text-xs text-[var(--terracotta)] hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            items.map((it) => {
              const isRead = !!it.read_at;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    markOne(it.id);
                    setOpen(false);
                  }}
                  className={`block w-full border-b px-3 py-2.5 text-left text-sm transition hover:bg-[var(--cream)]/60 ${
                    isRead ? "opacity-70" : "bg-[var(--terracotta-soft)]/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-[var(--charcoal)]">{it.title}</div>
                    <div className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(it.created_at)}
                    </div>
                  </div>
                  {it.body && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {it.body}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
