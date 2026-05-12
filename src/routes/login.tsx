import { createFileRoute, Navigate } from "@tanstack/react-router";

// Backward-compatible: every login lives at "/" now.
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Saffron Planning Studio" }] }),
  component: () => <Navigate to="/" replace />,
});
