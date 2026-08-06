import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Heart,
  BarChart3,
  Bell,
  CalendarDays,
  Shield,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import logoLight from "@/assets/saffron-logo-transparent.png";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";
import { readTheme, applyTheme, DEFAULT_THEME, type StudioTheme } from "@/lib/studio-theme";

const COLLAPSED_KEY = "saffron.sidebar.collapsed";
const WIDTH_EXPANDED = "200px";
const WIDTH_COLLAPSED = "56px";

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Studio branding: apply the saved colour/font on load and react to changes
  // made on the Profile page without needing a reload.
  const [brand, setBrand] = useState(DEFAULT_THEME.brandName);
  useEffect(() => {
    const theme = readTheme();
    applyTheme(theme);
    setBrand(theme.brandName);
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<StudioTheme>).detail;
      if (next) setBrand(next.brandName);
    };
    window.addEventListener("saffron:theme", onChange);
    return () => window.removeEventListener("saffron:theme", onChange);
  }, []);

  // "Saffron Planning Studio" → lead word on top, remainder beneath.
  const [brandLead, ...brandRest] = brand.trim().split(/\s+/);
  const brandTail = brandRest.join(" ");

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED,
    );
  }, [collapsed]);

  const toggle = () => setCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
    return next;
  });

  // The icon-only rail is a desktop affordance (the toggle button that
  // drives it is itself `lg:flex` only). The mobile drawer is always full
  // width, so it must never inherit the desktop "collapsed" state — labels,
  // the full wordmark, and badges should always render there.
  const effectiveCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="app-header-safe fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-[var(--border)] bg-[var(--cream)] px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--charcoal)]/70 hover:bg-[var(--cream-deep)]"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/admin" className="ml-3 font-display text-base font-semibold text-[var(--terracotta)]">
          Saffron
        </Link>
      </div>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          // Desktop: instant width change (no transition — avoids mid-animation click misses)
          // Mobile: slide-in/out transition only
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-[var(--border)] bg-[var(--cream)]",
          collapsed ? "lg:w-[56px]" : "lg:w-[200px]",
          mobileOpen
            ? "translate-x-0 w-[200px] transition-transform duration-200"
            : "-translate-x-full w-[200px] lg:translate-x-0 lg:transition-none transition-transform duration-200",
        ].join(" ")}
      >
        {/* Wordmark — the logo mark only survives in the collapsed rail.
            h-14 matches the page toolbars so the two bottom borders form one
            continuous line across the sidebar and content. */}
        <div className={`flex h-14 shrink-0 items-center border-b border-[var(--border)]/60 ${effectiveCollapsed ? "justify-center px-0" : "px-4"}`}>
          {effectiveCollapsed ? (
            <Link to="/admin" className="shrink-0">
              <img src={logoLight} alt="Saffron" className="h-7 w-auto object-contain" />
            </Link>
          ) : (
            <Link to="/admin" onClick={() => setMobileOpen(false)} className="min-w-0" title={brand}>
              <div className="truncate font-display text-lg font-semibold leading-none text-[var(--terracotta)]">
                {brandLead}
              </div>
              {brandTail && (
                <div className="mt-1 truncate font-sans text-[10px] uppercase tracking-[0.18em] text-[var(--charcoal)]/45">
                  {brandTail}
                </div>
              )}
            </Link>
          )}
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded text-[var(--charcoal)]/50 hover:text-[var(--charcoal)] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          <NavItem to="/admin/dashboard" icon={<LayoutDashboard className="h-[18px] w-[18px]" />} label="Dashboard" collapsed={effectiveCollapsed} onClick={() => setMobileOpen(false)} />
          <NavItem to="/admin" exact icon={<Users className="h-[18px] w-[18px]" />} label="Vendors" collapsed={effectiveCollapsed} onClick={() => setMobileOpen(false)} />
          <NavItem to="/admin/projects" icon={<Heart className="h-[18px] w-[18px]" />} label="Projects" collapsed={effectiveCollapsed} onClick={() => setMobileOpen(false)} />
          <AdminNavItem to="/admin/analytics" icon={<BarChart3 className="h-[18px] w-[18px]" />} label="Analytics" collapsed={effectiveCollapsed} onClick={() => setMobileOpen(false)} />
          <NotificationsNavItem collapsed={effectiveCollapsed} mounted={mounted} onClick={() => setMobileOpen(false)} />
          <NavItem to="/admin/calendar" icon={<CalendarDays className="h-[18px] w-[18px]" />} label="Calendar" collapsed={effectiveCollapsed} onClick={() => setMobileOpen(false)} />

          <div className="my-3 mx-3 border-t border-[var(--border)]" />

          <NavItem to="/admin/profile" icon={<UserCircle className="h-[18px] w-[18px]" />} label="Profile" collapsed={effectiveCollapsed} onClick={() => setMobileOpen(false)} />
          <AdminNavItem to="/admin/users" icon={<Shield className="h-[18px] w-[18px]" />} label="Admin" collapsed={effectiveCollapsed} onClick={() => setMobileOpen(false)} />
        </nav>

        {/* Bottom cluster */}
        <div className="border-t border-[var(--border)] pb-4 pt-3">
          <SidebarLogout collapsed={effectiveCollapsed} />
          {/* Same shape as Sign out, cooler hover so the two never read as one action */}
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "mx-2 my-0.5 hidden w-[calc(100%-16px)] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--charcoal)]/60 transition-colors hover:bg-[var(--cream-deep)] hover:text-[var(--charcoal)] lg:flex",
              collapsed ? "justify-center px-0" : "",
            ].join(" ")}
          >
            {collapsed
              ? <ChevronRight className="h-[18px] w-[18px] shrink-0" />
              : <ChevronLeft className="h-[18px] w-[18px] shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────

function NavItem({
  to,
  exact,
  icon,
  label,
  collapsed,
  onClick,
  badge,
}: {
  to: string;
  exact?: boolean;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact
    ? pathname === to || pathname === to + "/"
    : pathname.startsWith(to);

  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={[
        "mx-2 my-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--terracotta)] text-[var(--cream)]"
          : "text-[var(--charcoal)]/70 hover:bg-[var(--cream-deep)] hover:text-[var(--charcoal)]",
        collapsed ? "justify-center px-0" : "",
      ].join(" ")}
    >
      <span className="relative shrink-0">
        {icon}
        {/* The collapsed rail has no room for a count — dot the icon instead */}
        {collapsed && !!badge && (
          <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-[var(--terracotta)] ring-2 ring-[var(--cream)]" />
        )}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && !!badge && (
        <span
          className={`ml-auto min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none ${
            active
              ? "bg-[var(--cream)]/25 text-[var(--cream)]"
              : "bg-[var(--terracotta)] text-[var(--cream)]"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function AdminNavItem(props: Parameters<typeof NavItem>[0]) {
  const { role } = useAuth();
  if (role !== "admin") return null;
  return <NavItem {...props} />;
}

function NotificationsNavItem({
  collapsed,
  mounted,
  onClick,
}: {
  collapsed: boolean;
  mounted: boolean;
  onClick?: () => void;
}) {
  const { session, initialized } = useAuth();
  const { data } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => getUnreadNotificationCount(),
    enabled: mounted && initialized && !!session?.access_token,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return (
    <NavItem
      to="/admin/notifications"
      icon={<Bell className="h-[18px] w-[18px]" />}
      label="Notifications"
      collapsed={collapsed}
      onClick={onClick}
      badge={data?.count ?? 0}
    />
  );
}

function SidebarLogout({ collapsed }: { collapsed: boolean }) {
  const { user, signOut } = useAuth();
  const confirm = useConfirm();
  if (!user) return null;

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign out?",
      description: "You'll need to sign back in to access the dashboard.",
      confirmLabel: "Sign out",
    });
    if (ok) await signOut();
  };

  return (
    <button
      onClick={handleSignOut}
      title={collapsed ? "Sign out" : undefined}
      className={[
        "mx-2 my-0.5 flex w-[calc(100%-16px)] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--charcoal)]/60 transition-colors hover:bg-[var(--terracotta-soft)] hover:text-[var(--terracotta)]",
        collapsed ? "justify-center px-0" : "",
      ].join(" ")}
    >
      <LogOut className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span>Sign out</span>}
    </button>
  );
}

// ── Mobile bottom tab bar ────────────────────────────────────────────────────
// Quick access to the four most-visited destinations, the way a phone app
// would. Everything else (Vendors, Analytics, Notifications, Admin, Sign
// out) still lives behind the hamburger drawer above.

const MOBILE_TAB_ITEMS = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/admin/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/admin/projects", icon: Heart, label: "Projects" },
  { to: "/admin/profile", icon: UserCircle, label: "Profile" },
] as const;

export function AdminMobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="app-footer-safe fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-[var(--border)] bg-[var(--cream)] lg:hidden">
      {MOBILE_TAB_ITEMS.map(({ to, icon: Icon, label }) => {
        const active = pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
              active ? "text-[var(--terracotta)]" : "text-[var(--charcoal)]/55"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
