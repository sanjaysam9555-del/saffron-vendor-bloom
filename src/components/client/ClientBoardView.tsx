import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { ClientVendor } from "@/lib/project-types";
import {
  CLIENT_STATUS_OPTIONS,
  type ClientVendorStatus,
} from "@/lib/client-status";
import { useSetVendorStatus } from "@/hooks/useSetVendorStatus";
import { ClientBoardCard } from "./ClientBoardCard";
import { ClientBoardColumn } from "./ClientBoardColumn";

interface Props {
  vendors: ClientVendor[];
  onView: (v: ClientVendor) => void;
}

const COLUMN_ORDER: { id: string; status: ClientVendorStatus | null }[] = [
  { id: "col-none", status: null },
  { id: "col-like", status: "like" },
  { id: "col-shortlisted", status: "shortlisted" },
  { id: "col-thinking", status: "thinking" },
  { id: "col-finalised", status: "finalised" },
  { id: "col-rejected", status: "rejected" },
];

const STATUS_BY_COLUMN: Record<string, ClientVendorStatus | null> =
  Object.fromEntries(COLUMN_ORDER.map((c) => [c.id, c.status]));

export function ClientBoardView({ vendors, onView }: Props) {
  const mutation = useSetVendorStatus();
  const [activeVendor, setActiveVendor] = useState<ClientVendor | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ClientVendor[]>();
    for (const c of COLUMN_ORDER) map.set(c.id, []);
    for (const v of vendors) {
      const colId =
        COLUMN_ORDER.find((c) => c.status === (v.client_status ?? null))?.id ??
        "col-none";
      map.get(colId)!.push(v);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));
    }
    return map;
  }, [vendors]);

  const handleDragStart = (e: DragStartEvent) => {
    const v = vendors.find((x) => x.id === e.active.id);
    setActiveVendor(v ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveVendor(null);
    const { active, over } = e;
    if (!over) return;
    const vendor = vendors.find((v) => v.id === active.id);
    if (!vendor) return;
    const nextStatus = STATUS_BY_COLUMN[over.id as string];
    if (nextStatus === undefined) return;
    if ((vendor.client_status ?? null) === nextStatus) return;
    mutation.mutate({ vendor_id: vendor.id, status: nextStatus });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveVendor(null)}
    >
      <div className="-mx-6 overflow-x-auto px-6 pb-4 lg:-mx-8 lg:px-8">
        <div className="flex min-h-[60vh] gap-3">
          {COLUMN_ORDER.map(({ id, status }) => {
            const opt = status
              ? CLIENT_STATUS_OPTIONS.find((o) => o.value === status) ?? null
              : null;
            const items = grouped.get(id) ?? [];
            return (
              <ClientBoardColumn
                key={id}
                id={id}
                option={opt}
                count={items.length}
              >
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[var(--border)] py-6 text-center text-[11px] text-[var(--charcoal)]/40">
                    Drop vendors here
                  </div>
                ) : (
                  items.map((v) => (
                    <ClientBoardCard
                      key={v.id}
                      vendor={v}
                      onView={() => onView(v)}
                    />
                  ))
                )}
              </ClientBoardColumn>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeVendor ? (
          <div className="w-72 rotate-2 cursor-grabbing">
            <ClientBoardCard vendor={activeVendor} onView={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
