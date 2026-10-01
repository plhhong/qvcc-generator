# Agent rules

- User administration (create, update, suspend, delete, role changes) goes only through the `admin-users` edge function, which verifies `has_role(uid, 'admin')` server-side and writes `admin_audit_log`. Why: privileged auth operations need the service role and must never trust client checks.
- Roles live in `public.user_roles` and are checked via the `has_role` security-definer function. Why: avoids privilege escalation and recursive RLS.
