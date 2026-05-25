import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/client/login")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => <Navigate to="/" replace />,
});
