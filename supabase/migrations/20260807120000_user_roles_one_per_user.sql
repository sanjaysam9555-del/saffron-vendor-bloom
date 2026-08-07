-- Every part of the app (RBAC checks, the Team/Client split, staff-only
-- assertions, assignee pickers) treats role as a single, exclusive value
-- per user. The schema didn't enforce that — UNIQUE(user_id, role) only
-- blocked an exact duplicate pair, so a user could hold two different
-- roles at once (this let 4 client accounts pick up a stray 'employee'
-- row and leak into staff-only pickers). Tighten it to one row per user.
alter table public.user_roles
  drop constraint if exists user_roles_user_id_role_key;

alter table public.user_roles
  add constraint user_roles_user_id_key unique (user_id);
