import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RealtimeSubscription {
  /** Postgres table name (in `public` schema). */
  table: string;
  /** Optional Supabase realtime filter, e.g. `project_id=eq.<uuid>`. */
  filter?: string;
  /** Query keys to invalidate on any change. */
  invalidate: ReadonlyArray<ReadonlyArray<unknown>>;
}

/**
 * Subscribes to one Supabase realtime channel that listens to multiple
 * Postgres tables and invalidates the matching React Query caches whenever a
 * change comes in. Pass `enabled: false` to defer until prerequisites (e.g. a
 * route param) are ready.
 */
export function useRealtimeInvalidate(
  channelKey: string,
  subscriptions: RealtimeSubscription[],
  options?: { enabled?: boolean },
) {
  const qc = useQueryClient();
  const enabled = options?.enabled ?? true;
  // Stable JSON signature so consumers can pass inline arrays.
  const sig = JSON.stringify(subscriptions);

  useEffect(() => {
    if (!enabled) return;
    const subs = JSON.parse(sig) as RealtimeSubscription[];
    let channel = supabase.channel(channelKey);
    for (const s of subs) {
      channel = channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
        () => {
          for (const key of s.invalidate) {
            qc.invalidateQueries({ queryKey: key as unknown[] });
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelKey, sig, enabled, qc]);
}
