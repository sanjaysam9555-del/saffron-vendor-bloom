import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/vendor-signup")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "canonical", href: "https://planwithsaffron.in/vendor-onboarding" },
    ],
  }),
  component: () => <Navigate to="/vendor-onboarding" />,
});
