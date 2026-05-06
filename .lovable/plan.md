# Fix: Login page flashes on iPhone PWA cold boot

## Root cause

The flash is **not** an auth race — the auth gating already keeps the splash up until role is known. The flash is **server-rendered HTML**.

In `src/routes/index.tsx`:

- Lines 30–44 render the marketing hero ("Saffron Planning Studio", "Wedding & Event Planning Studio in India", paragraph) **outside** any `ClientOnly`. That means it ships in the SSR HTML for `/`.
- Line 47: `<ClientOnly fallback={<ClientLoginForm embedded />}>` — the SSR fallback **is the login form**.

So the HTML the iPhone receives for `/` literally contains marketing copy + the login form. iOS paints that HTML the moment the PWA opens, **before** any JavaScript runs. Then React hydrates, `RedirectingLogin` mounts, sees the cached session, and the splash overlay covers everything. Result: a brief but very visible flash of the login page on every cold boot.

The previous "opening plate" splash (1.5s `setTimeout`) only kicks in **after** hydration, so it can't hide the pre-hydration paint.

## Fix

Make the SSR output of `/` the branded splash itself — never marketing copy, never the login form. Only after the client hydrates and confirms there is no session do we swap to the real marketing + login UI.

### Change 1: `src/routes/index.tsx`

Move the entire marketing section + login form into the client-only branch, and use `<BrandSplash showLoading={false} />` as the `ClientOnly` fallback.

```tsx
function RootIndex() {
  return (
    <main className="min-h-screen bg-[var(--cream)]">
      <ClientOnly fallback={<BrandSplash showLoading={false} />}>
        <RedirectingLogin />
      </ClientOnly>
    </main>
  );
}

function RedirectingLogin() {
  const { session, role, initialized } = useAuth();
  const navigate = useNavigate();

  // Keep the opening plate so first-time visitors also see brand, not a flash
  // of the login form, while auth restores from localStorage.
  const [openingPlate, setOpeningPlate] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOpeningPlate(false), 800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!initialized || !session) return;
    if (role === "client") navigate({ to: "/client", replace: true });
    else if (role === "admin" || role === "employee") navigate({ to: "/admin", replace: true });
  }, [initialized, session, role, navigate]);

  if (openingPlate || !initialized) return <BrandSplash showLoading={false} />;
  if (session) return <BrandSplash />; // signed in — keep splash until redirect fires

  // No session — now it's safe to reveal marketing + login form.
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-2 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--terracotta)]">
          Saffron Planning Studio
        </p>
        <h1 className="mt-2 font-display text-2xl text-[var(--charcoal)] sm:text-3xl">
          Wedding & Event Planning Studio in India
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--charcoal)]/70">
          We curate vendors, manage logistics and design weddings end-to-end across
          Delhi NCR and destinations across India. Couples we work with use this
          portal to view their shortlist, share feedback and finalise decisions
          with their planner.
        </p>
      </section>
      <div className="px-4 pb-10 pt-3">
        <ClientLoginForm embedded />
      </div>
    </>
  );
}
```

That's the only file change.

## Why this works

- **SSR HTML for `/` becomes just the branded splash on a cream background.** The iPhone's first paint after the PWA launch is the splash — identical to the dashboard's cream background — so there's nothing to flash.
- React hydrates, reads the cached session+role from `localStorage` (already implemented in `src/lib/auth.tsx`), and `AuthGate` on `/admin` or `/client` renders the dashboard immediately (no second splash since cached role passes the gate per `src/components/AuthGate.tsx`).
- For unauthenticated visitors, the splash holds for ~800ms then reveals marketing + login. No worse than today.

## SEO note

Marketing copy will no longer be in SSR HTML for `/`. That's acceptable here because `/` is effectively the login gateway for a private portal — but worth flagging. If SEO on `/` matters, we can later split: a public `/` marketing route and a separate `/login` for the gateway. Not doing that now.

## Files changed

- `src/routes/index.tsx` — restructure render so SSR output is the brand splash, not the marketing+login content.
