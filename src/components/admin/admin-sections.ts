import { Users, Store, Heart, Database, Archive } from "lucide-react";

/**
 * Single source of truth for the Admin section list — used by the settings
 * hub (the cards) and the sidebar (to know which paths count as "Admin").
 * Add new sections (e.g. Subscription) here only; nothing else needs to
 * change to make them show up.
 */
export const ADMIN_SECTIONS = [
  {
    to: "/admin/users",
    label: "Manage Users",
    description: "Create staff and client accounts, and manage their access.",
    icon: Users,
  },
  {
    to: "/admin/manage-vendors",
    label: "Manage Vendors",
    description: "Categories, incoming submissions, and Instagram sync.",
    icon: Store,
  },
  {
    to: "/admin/manage-projects",
    label: "Manage Projects",
    description: "Create, edit, archive, or delete wedding projects.",
    icon: Heart,
  },
  {
    to: "/admin/data",
    label: "Data Management",
    description: "Move vendors and projects in and out of the studio, or take everything with you.",
    icon: Database,
  },
  {
    to: "/admin/backups",
    label: "Backup & Restore",
    description: "A snapshot of the whole database is taken automatically every midnight.",
    icon: Archive,
  },
] as const;

export const ADMIN_SETTINGS_HOME = "/admin/settings";
