import { useEffect, useState } from "react";

export type Criticality = "low" | "medium" | "high";

export type UrgencyBucket =
  | "booked"
  | "overdue"
  | "urgent"
  | "soon"
  | "plan"
  | "upcoming"
  | "unset";

export interface TimelineItem {
  category: string;
  vendor_count: number;
  due_date: string | null;
  criticality: Criticality;
  notes: string | null;
  booked: boolean;
  booked_vendor_name: string | null;
  planned_amount: number | null;
  closed_amount_auto: number | null;
  actual_amount_override: number | null;
}

const BUCKET_ORDER: UrgencyBucket[] = [
  "overdue",
  "urgent",
  "soon",
  "plan",
  "upcoming",
  "unset",
  "booked",
];

export const BUCKET_LABEL: Record<UrgencyBucket, string> = {
  overdue: "Overdue",
  urgent: "Urgent",
  soon: "Due soon",
  plan: "Plan soon",
  upcoming: "Upcoming",
  unset: "Needs deadline",
  booked: "Booked",
};

export function bucketRank(b: UrgencyBucket): number {
  return BUCKET_ORDER.indexOf(b);
}

/** Whole-day diff (today→due, today at local midnight). */
export function daysBetween(today: Date, due: Date): number {
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / 86400000);
}

export function classifyUrgency(
  item: TimelineItem,
  now: Date,
): { bucket: UrgencyBucket; daysLeft: number | null } {
  if (item.booked) return { bucket: "booked", daysLeft: null };
  if (!item.due_date) return { bucket: "unset", daysLeft: null };
  const due = new Date(item.due_date);
  const days = daysBetween(now, due);
  let bucket: UrgencyBucket;
  if (days <= 0) bucket = "overdue";
  else if (days <= 7) bucket = "urgent";
  else if (days <= 14) bucket = "soon";
  else if (days <= 30) bucket = "plan";
  else bucket = "upcoming";

  // Criticality shifts: high bumps up one bucket, low softens one.
  const order: UrgencyBucket[] = ["upcoming", "plan", "soon", "urgent", "overdue"];
  const i = order.indexOf(bucket);
  if (i >= 0) {
    if (item.criticality === "high") bucket = order[Math.min(order.length - 1, i + 1)];
    if (item.criticality === "low") bucket = order[Math.max(0, i - 1)];
  }
  return { bucket, daysLeft: days };
}

export const BUCKET_TOKEN: Record<UrgencyBucket, string> = {
  overdue: "var(--urgency-overdue)",
  urgent: "var(--urgency-urgent)",
  soon: "var(--urgency-soon)",
  plan: "var(--urgency-plan)",
  upcoming: "var(--urgency-upcoming)",
  unset: "var(--urgency-unset)",
  booked: "var(--urgency-booked)",
};

/** Tick every 60s so urgency rolls over without reload. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function sortItems(items: TimelineItem[], now: Date): TimelineItem[] {
  return [...items].sort((a, b) => {
    const ra = bucketRank(classifyUrgency(a, now).bucket);
    const rb = bucketRank(classifyUrgency(b, now).bucket);
    if (ra !== rb) return ra - rb;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.category.localeCompare(b.category);
  });
}

export function groupByBucket(items: TimelineItem[], now: Date) {
  const groups = new Map<UrgencyBucket, TimelineItem[]>();
  for (const b of BUCKET_ORDER) groups.set(b, []);
  for (const it of items) {
    const { bucket } = classifyUrgency(it, now);
    groups.get(bucket)!.push(it);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return a.category.localeCompare(b.category);
    });
  }
  return BUCKET_ORDER.map((b) => ({ bucket: b, items: groups.get(b)! })).filter(
    (g) => g.items.length > 0,
  );
}

export function formatDueDate(due: string | null): string {
  if (!due) return "—";
  const d = new Date(due);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function daysLeftLabel(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  return `${days} days left`;
}
