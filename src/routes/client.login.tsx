import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/client/login")({
  component: () => <Navigate to="/" replace />,
});
