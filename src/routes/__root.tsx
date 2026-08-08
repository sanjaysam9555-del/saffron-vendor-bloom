import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { RouteProgress } from "@/components/RouteProgress";
import { SplashScreen } from "@/components/SplashScreen";
import { UniversalSearchDialog } from "@/components/search/UniversalSearch";
import { installChunkRecovery } from "@/lib/chunk-recover";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-[var(--terracotta)]">404</h1>
        <h2 className="mt-4 font-display text-2xl text-[var(--charcoal)]">Page not found</h2>
        <p className="mt-2 text-sm text-[var(--charcoal)]/74">
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
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { httpEquiv: "X-UA-Compatible", content: "IE=edge" },
      { name: "color-scheme", content: "light" },
      { name: "supported-color-schemes", content: "light" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Saffron" },
      { title: "Wedding & Event Planning Studio | Saffron Planning Studio" },
      {
        name: "description",
        content:
          "Boutique wedding & event planning studio in India crafting unforgettable celebrations — from intimate gatherings to grand destination weddings.",
      },
      {
        name: "keywords",
        content:
          "wedding planner India, event planning studio, wedding planning services, Saffron Planning Studio, boutique event planner, wedding coordinator India",
      },
      { name: "author", content: "Saffron Planning Studio" },
      {
        name: "robots",
        content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      },
      { name: "theme-color", content: "#F5F0E8" },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#F5F0E8" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#F5F0E8" },

      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Saffron Planning Studio" },
      { property: "og:image", content: "https://planwithsaffron.in/og-cover.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Saffron Planning Studio — Wedding & Event Planning Studio" },
      { property: "og:locale", content: "en_IN" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Wedding & Event Planning Studio | Saffron Planning Studio" },
      {
        name: "twitter:description",
        content: "Boutique wedding & event planning studio in India. Crafting unforgettable celebrations.",
      },
      { name: "twitter:image", content: "https://planwithsaffron.in/og-cover.jpg" },
      { name: "twitter:image:alt", content: "Saffron Planning Studio — Wedding & Event Planning Studio" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Eagerly load the display font used by the splash screen so the
      // welcome plate renders in brand typography on first paint.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap",
      },
      // Body font (Jost) loads non-blocking; promoted to "all" by the
      // inline script below once the stylesheet is ready.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Jost:wght@300;400;500;600&display=swap",
        media: "print",
      },
    ],
    scripts: [
      {
        // Promote the print-only fonts stylesheet to "all" once it loads,
        // so Google Fonts never blocks first paint but still applies fonts.
        children: `(function(){var l=document.querySelectorAll('link[rel="stylesheet"][media="print"]');l.forEach(function(x){function f(){x.media='all'}if(x.sheet){f()}else{x.addEventListener('load',f,{once:true})}})})();`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["EventPlanningService", "LocalBusiness"],
          name: "Saffron Planning Studio",
          alternateName: "Plan with Saffron",
          url: "https://planwithsaffron.in",
          logo: "https://planwithsaffron.in/apple-touch-icon.png",
          image: "https://planwithsaffron.in/og-cover.jpg",
          description:
            "Saffron Planning Studio is a boutique wedding and event planning studio in India, crafting unforgettable celebrations from intimate gatherings to grand weddings.",
          priceRange: "₹₹₹",
          currenciesAccepted: "INR",
          paymentAccepted: "Cash, Credit Card, Bank Transfer",
          areaServed: { "@type": "Country", name: "India" },
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            availableLanguage: ["English", "Hindi"],
            email: "hello@planwithsaffron.in",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
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
  useEffect(() => { installChunkRecovery(); }, []);
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Treat data as fresh for 5 minutes. Realtime channels still push
        // live updates, and route navigation no longer triggers a refetch
        // storm — pages feel instant on back/forward.
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
        retry: 1,
        retryDelay: 400,
      },
    },
  }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ConfirmProvider>
          <RouteProgress />
          <SplashScreen />
          <Outlet />
          <UniversalSearchDialog />
          <Toaster />
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

