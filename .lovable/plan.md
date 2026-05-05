## Problem

Admins get `permission denied for function has_role` when editing custom categories (rename / delete / add).

## Root cause

The `public.has_role(uuid, app_role)` function only has EXECUTE granted to `postgres`, `service_role`, and `sandbox_exec` — **not to `authenticated`**.

```
Access privileges:
  postgres=X/postgres
  service_role=X/postgres
  sandbox_exec=X/postgres
```

Every RLS policy on `categories` (Staff insert / Staff update / Admin delete) calls `public.has_role(auth.uid(), 'admin')`. When the browser hits the table as the `authenticated` role, Postgres tries to execute `has_role()` and fails with permission denied — even though the function is SECURITY DEFINER, the caller still needs the EXECUTE grant.

The same latent bug exists for `public.has_project_access(...)` and `public.client_can_view_vendor(...)`, which are also referenced from RLS policies. They happen to work today only because earlier migrations granted EXECUTE on them. We'll grant defensively to be safe.

## Fix — single migration

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.has_project_access(uuid, uuid)
  TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.client_can_view_vendor(uuid, uuid)
  TO authenticated, anon;
```

This is safe: the functions are SECURITY DEFINER with `STABLE` and a pinned `search_path = public`, so granting EXECUTE only lets the authenticated user *invoke* them — they don't get any extra table privileges. RLS still gates everything.

## Verification

- As an admin, rename a custom category → succeeds, no `permission denied` error.
- As an admin, delete a custom category → succeeds.
- As an admin, add a new category → succeeds.
- Non-staff (client) users still cannot insert/update/delete categories (their `has_role(..., 'admin')` returns `false`, the policy denies, RLS returns nothing).
