# Admin section: manage users

## What you get
- A new **Admin** item in the sidebar, visible only to admins.
- An **Admin > Users** page listing every user: email, display name, role, created date, last sign-in, and how many projects and posts they have.
- Search by email and filter by role.
- **Create user**: email, password, display name, role (admin or user). The email is confirmed automatically.
- **Edit user**: change the email, display name, or role, or reset the password.
- **Suspend or reactivate** a user to block or restore their sign-in.
- **Delete user**: asks you to confirm first, then removes the user and all their content.
- Admins can't delete, suspend, or demote their own account, so the app can't be left with no admin.
- plh.hong@gmail.com gets the first admin role.

## Security
- Roles live in their own table. Admin status is checked on the server for every action, never only in the browser.
- All user changes go through one server function that runs with full access. That function checks the caller is an admin before doing anything.
- Every admin action is saved to an audit log that can't be edited: who did it, what they did, which user it affected, when, and whether it worked.

## Technical details
- Migration:
  - `app_role` enum and `user_roles` table, following the standard pattern with grants and RLS.
  - `has_role()` security-definer function.
  - `profiles` table (id, display_name, timestamps) with grants and RLS: users read and update their own row, admins read all rows. A trigger on new sign-up creates the profile and gives the `user` role.
  - Backfill profiles and roles for existing users.
  - `admin_audit_log` table: insert by service_role only, select by admins only.
- Data step: give the `admin` role to plh.hong@gmail.com.
- New edge function `admin-users`. It reads the JWT, checks `has_role(admin)`, and validates input with Zod. Actions: `list`, `create`, `update`, `set_role`, `reset_password`, `suspend` (ban_duration), `delete`. Delete first removes the user's posts, variants, signals, sources, and brand voices, then calls `auth.admin.deleteUser`.
- Frontend:
  - `src/features/admin/` with the service (`supabase.functions.invoke`), React Query hooks with toasts, and Zod schemas.
  - Components: `UsersTable`, `UserFormDialog` (react-hook-form), and `DeleteUserDialog`.
  - `useIsAdmin` hook that queries `user_roles`.
  - `AdminRoute` guard and an `/admin/users` route.
  - Conditional sidebar link in AppLayout.
- Add an `AGENTS.md` rule: admin operations go only through the `admin-users` function, with roles checked by `has_role`.
