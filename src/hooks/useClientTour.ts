import { useCallback, useRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { markTourCompleted } from "@/components/client/ClientTourButton";

type ClientView = "grid" | "board" | "table" | "timeline" | "summary";

interface Options {
  setView: (v: ClientView) => void;
}

/**
 * Builds a driver.js tour for the client dashboard.
 * Each step targets an existing element via `data-tour="..."`.
 * Steps requiring a specific view auto-switch before being shown.
 */
export function useClientTour({ setView }: Options) {
  const driverRef = useRef<Driver | null>(null);

  const start = useCallback(() => {
    const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

    const ensureView = async (v: ClientView) => {
      setView(v);
      // Allow React to re-render before driver re-measures.
      await wait(220);
    };

    const popover = (title: string, description: string) => ({
      title,
      description,
      popoverClass: "saffron-tour",
    });

    const steps: DriveStep[] = [
      {
        element: '[data-tour="header-greeting"]',
        popover: popover(
          "Welcome to your Vendor Folio",
          "This is your private wedding planning dashboard, curated by your Saffron planner. Let's take a quick tour so you know where everything lives.",
        ),
      },
      {
        element: '[data-tour="urgency-strip"]',
        popover: popover(
          "Needs your attention",
          "Time-sensitive categories surface here. Tap any chip to jump straight to that category in the Overview.",
        ),
      },
      {
        element: '[data-tour="view-toggle"]',
        popover: popover(
          "Switch how you view vendors",
          "Same data, five lenses: Overview, Table, Board, Vendor View and Summary. Pick whichever helps you decide faster.",
        ),
      },
      {
        element: '[data-tour="view-toggle-timeline"]',
        popover: popover(
          "Overview",
          "Track per-category booking deadlines and budgets. Great for week-to-week planning with your Saffron team.",
        ),
        onHighlightStarted: () => ensureView("timeline"),
      },
      {
        element: '[data-tour="view-toggle-table"]',
        popover: popover(
          "Table",
          "All vendors in one sortable list — compare prices, ratings and locations side-by-side.",
        ),
        onHighlightStarted: () => ensureView("table"),
      },
      {
        element: '[data-tour="view-toggle-board"]',
        popover: popover(
          "Board",
          "A Kanban board to move vendors across stages: We like it → Shortlisted → Finalised → Rejected.",
        ),
        onHighlightStarted: () => ensureView("board"),
      },
      {
        element: '[data-tour="view-toggle-grid"]',
        popover: popover(
          "Vendor View",
          "Browse rich vendor cards with photos, Instagram previews and quick actions.",
        ),
        onHighlightStarted: () => ensureView("grid"),
      },
      {
        element: '[data-tour="view-toggle-summary"]',
        popover: popover(
          "Summary",
          "A clean snapshot of your wedding — countdown, your picks, booked categories and spend, all in one place.",
        ),
        onHighlightStarted: () => ensureView("summary"),
      },
      {
        element: '[data-tour="overview-sub-timeline"]',
        popover: popover(
          "Overview · Timeline tab",
          "Inside Overview, the Timeline tab shows each category on a horizontal track — see what's due soon and what's already booked at a glance.",
        ),
        onHighlightStarted: () => ensureView("timeline"),
      },
      {
        element: '[data-tour="overview-sub-table"]',
        popover: popover(
          "Overview · Table tab",
          "Switch to the Table tab inside Overview for a compact list of every category with deadlines, status and budget — perfect for week-by-week planning.",
        ),
        onHighlightStarted: () => ensureView("timeline"),
      },
      {
        // Resolved at runtime — prefers the mobile filters button, falls back
        // to the always-present desktop filters panel.
        element: () =>
          (document.querySelector('[data-tour="filters-button"]:not([hidden])') as HTMLElement | null)
          ?? (document.querySelector('[data-tour="filters-panel"]') as HTMLElement | null)
          ?? document.body,
        popover: popover(
          "Filters",
          "Narrow vendors by category or location. Useful when your folio has lots of options.",
        ),
      },
      {
        element: '[data-tour="search-input"]',
        popover: popover(
          "Search",
          "Find any vendor instantly by name, Instagram handle, subcategory or location.",
        ),
      },
      {
        element: '[data-tour="notifications-bell"]',
        popover: popover(
          "Notifications",
          "Quote updates, comments from your planner, and important changes land here.",
        ),
      },
      {
        element: '[data-tour="tour-button"]',
        popover: popover(
          "Re-take this tour any time",
          "Click this button whenever you'd like a refresher. That's it — happy planning!",
        ),
      },
    ];

    // Filter out steps whose target element doesn't currently exist
    // (defensive — driver.js otherwise throws).
    const liveSteps = steps.filter((s) => {
      if (typeof s.element === "function") return true;
      if (typeof s.element !== "string") return true;
      if (s.onHighlightStarted) return true;
      return !!document.querySelector(s.element);
    });

    driverRef.current?.destroy();
    const d = driver({
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      animate: true,
      smoothScroll: true,
      allowClose: true,
      stagePadding: 6,
      stageRadius: 8,
      overlayOpacity: 0.55,
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done",
      popoverClass: "saffron-tour",
      steps: liveSteps,
      onDestroyed: () => {
        markTourCompleted();
      },
    });
    driverRef.current = d;
    d.drive();
  }, [setView]);

  return { start };
}
