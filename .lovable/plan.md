## Problem

When the admin's session expires on the iPhone home-screen PWA, the app reloads to `/` which shows the **Client Portal** sign-in form. Because the PWA has no URL bar, the admin has no way to navigate to `/login` (the staff sign-in page). They are effectively locked out and must delete & reinstall the PWA, or open Safari separately.

## Solution

Add a small, discreet **"Staff sign in →"** link at the bottom of the `ClientLoginForm`. Tapping it navigates to `/login` (the existing admin/staff sign-in route), which works inside the PWA shell.

Also make the reverse path symmetric: add a small **"Client sign in →"** link on `/login` so a client who lands on the staff page can get back.

### Why a link (and not auto-detect role on `/`)

The current `/` form technically allows any Supabase user to authenticate, and `RedirectingLogin` *does* route admins to `/admin` after success. But:
- The page is branded "Client Portal" — admins reasonably assume their credentials won't work here.
- There is no visual affordance.
- A dedicated `/login` page already exists and is the correct destination.

A single link is the smallest, clearest fix.

## Changes

**`src/components/client/ClientLoginForm.tsx`**
- Add a `<Link to="/login">Staff sign in →</Link>` below the form, styled muted (small, `text-[var(--charcoal)]/55`, underline on hover).

**`src/routes/login.tsx`**
- Add a matching `<Link to="/">Client sign in →</Link>` below the staff form.

That's it — 2 small additions, no logic changes, no auth changes. Admin can now recover from a logged-out PWA by tapping "Staff sign in →".
