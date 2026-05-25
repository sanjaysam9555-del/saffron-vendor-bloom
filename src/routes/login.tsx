import { createFileRoute, Navigate } from "@tanstack/react-router";

// Backward-compatible: every login lives at "/" now.
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Saffron Planning Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <Navigate to="/" replace />,
});
