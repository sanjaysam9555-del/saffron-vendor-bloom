import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-[var(--terracotta)]">404</h1>
        <h2 className="mt-4 font-display text-2xl text-[var(--charcoal)]">Page not found</h2>
        <p className="mt-2 text-sm text-[var(--charcoal)]/60">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-lg bg-[var(--terracotta)] px-5 py-2.5 text-sm font-medium text-[var(--cream)] hover:bg-[var(--terracotta)]/90">
            Go to Vendor Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Saffron Events — Planning Studio" },
      { name: "description", content: "Saffron Vendor Hub manages wedding vendors, centralizing data for event planners." },
      { property: "og:title", content: "Saffron Events — Planning Studio" },
      { name: "twitter:title", content: "Saffron Events — Planning Studio" },
      { property: "og:description", content: "Saffron Vendor Hub manages wedding vendors, centralizing data for event planners." },
      { name: "twitter:description", content: "Saffron Vendor Hub manages wedding vendors, centralizing data for event planners." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7e2d1de8-2458-48e9-b9d1-6bab2bfe0e6a/id-preview-1148d56e--d7328052-e869-41c3-81e8-267167087b2a.lovable.app-1777546869219.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7e2d1de8-2458-48e9-b9d1-6bab2bfe0e6a/id-preview-1148d56e--d7328052-e869-41c3-81e8-267167087b2a.lovable.app-1777546869219.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Jost:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  );
}
