import { createFileRoute, Navigate } from "@tanstack/react-router";

// Backward-compatible: every login lives at "/" now.
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Saffron Planning Studio" },
      {
        name: "description",
        content:
          "Sign in to Saffron Planning Studio to view your shortlist, share feedback, and finalise vendors with your planner.",
      },
      { property: "og:title", content: "Sign in — Saffron Planning Studio" },
      {
        property: "og:description",
        content: "Access your Saffron Planning Studio dashboard.",
      },
      { property: "og:url", content: "https://planwithsaffron.in/login" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [
      { rel: "canonical", href: "https://planwithsaffron.in/login" },
    ],
  }),
  component: () => <Navigate to="/" replace />,
});
