import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { FilterState } from "@/components/vendor/Sidebar";

/**
 * Persistent UI state for the admin Vendors and Projects tabs.
 *
 * Both panes only mount when their tab is active (to avoid React-virtual /
 * ResizeObserver loops on hidden containers). To keep the experience
 * "switch as you left it", the UI state (search, filters, sort, view mode,
 * tab, scroll-position policies) lives here in the admin layout instead of
 * inside the pane components.
 *
 * Server data is preserved separately by React Query's cache, so no refetch
 * is required when toggling tabs as long as queries are warm.
 */

export type VendorSortKey =
  | "date_added_desc"
  | "date_added_asc"
  | "updated_desc"
  | "name_asc"
  | "name_desc";

export type VendorView = "cards" | "table";

export type ProjectTab = "active" | "archived";
export type ProjectSortKey = "upcoming" | "updated" | "most_vendors" | "most_quoted";

const DEFAULT_FILTERS: FilterState = {
  category: null,
  locations: [],
  minGoogleRating: null,
  minSaffronRating: null,
  submittedViaForm: "any",
  hasAttachment: "any",
  hasQuoteHistory: "any",
  assignedToProject: "any",
};

interface VendorTabState {
  search: string;
  setSearch: (v: string) => void;
  view: VendorView;
  setView: (v: VendorView) => void;
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  sort: VendorSortKey;
  setSort: (s: VendorSortKey) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}

interface ProjectTabState {
  tab: ProjectTab;
  setTab: (t: ProjectTab) => void;
  search: string;
  setSearch: (v: string) => void;
  sort: ProjectSortKey;
  setSort: (s: ProjectSortKey) => void;
}

interface AdminTabStateValue {
  vendor: VendorTabState;
  project: ProjectTabState;
}

const Ctx = createContext<AdminTabStateValue | null>(null);

export function AdminTabStateProvider({ children }: { children: ReactNode }) {
  // Vendor tab state
  const [search, setSearch] = useState("");
  const [view, setView] = useState<VendorView>("cards");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<VendorSortKey>("date_added_desc");
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(false);
  const setSidebarCollapsed = (v: boolean | ((prev: boolean) => boolean)) =>
    setSidebarCollapsedRaw(v as never);

  // Project tab state
  const [pTab, setPTab] = useState<ProjectTab>("active");
  const [pSearch, setPSearch] = useState("");
  const [pSort, setPSort] = useState<ProjectSortKey>("upcoming");

  const value = useMemo<AdminTabStateValue>(
    () => ({
      vendor: {
        search,
        setSearch,
        view,
        setView,
        filters,
        setFilters,
        sort,
        setSort,
        sidebarCollapsed,
        setSidebarCollapsed,
      },
      project: {
        tab: pTab,
        setTab: setPTab,
        search: pSearch,
        setSearch: setPSearch,
        sort: pSort,
        setSort: setPSort,
      },
    }),
    [search, view, filters, sort, sidebarCollapsed, pTab, pSearch, pSort],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVendorTabState(): VendorTabState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVendorTabState must be used inside AdminTabStateProvider");
  return v.vendor;
}

export function useProjectTabState(): ProjectTabState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProjectTabState must be used inside AdminTabStateProvider");
  return v.project;
}
