import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listStaffNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";
import { useAuth } from "@/lib/auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FlipNumber } from "@/components/motion/FlipNumber";

interface NotificationRow {
  id: string;
  kind: "comment" | "status_change";
  project_id: string | null;
  vendor_id: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, any>;
  read_by: Record<string, string> | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(0); // bump to re-trigger CSS animation
  const initialised = useRef(false);

  const unread = userId
    ? items.filter((i) => !i.read_by || !i.read_by[userId]).length
    : 0;

  const refresh = async () => {
    try {
      const rows = (await listStaffNotifications({ data: { limit: 30 } })) as NotificationRow[];
      setItems(rows);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    if (!userId) return;
    refresh().then(() => {
      initialised.current = true;
    });
    const ch = supabase
      .channel("staff_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_notifications" },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev].slice(0, 30));
          toast.info(row.title);
          // Only shake after the initial load (so first paint stays calm).
          if (initialised.current) setShake((n) => n + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const markOne = async (id: string) => {
    if (!userId) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, read_by: { ...(it.read_by ?? {}), [userId]: new Date().toISOString() } }
          : it,
      ),
    );
    try {
      await markNotificationRead({ data: { id } });
    } catch {}
  };

  const markAll = async () => {
    if (!userId) return;
    const stamp = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) => ({ ...it, read_by: { ...(it.read_by ?? {}), [userId]: stamp } })),
    );
    try {
      await markAllNotificationsRead({});
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--charcoal)]/70 transition hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]"
        >
          <Bell key={shake} className={shake ? "h-4 w-4 animate-bell-shake" : "h-4 w-4"} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[var(--terracotta)] px-1 text-[10px] font-semibold leading-4 text-white">
              {unread > 9 ? "9+" : <FlipNumber value={unread} duration={0.45} />}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="text-xs text-[var(--terracotta)] hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            items.map((it) => {
              const isRead = userId ? !!it.read_by?.[userId] : true;
              const href = it.project_id ? `/admin/projects/${it.project_id}` : "/admin";
              return (
                <Link
                  key={it.id}
                  to={href}
                  onClick={() => {
                    markOne(it.id);
                    setOpen(false);
                  }}
                  className={`block border-b px-3 py-2.5 text-sm transition hover:bg-[var(--cream)]/60 ${
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
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
