import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Role = z.enum(['admin', 'user']);
const Id = z.string().uuid();
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('create'), email: z.string().email().max(255), password: z.string().min(8).max(72), display_name: z.string().max(100).optional(), role: Role }),
  z.object({ action: z.literal('update'), user_id: Id, email: z.string().email().max(255).optional(), display_name: z.string().max(100).optional(), role: Role.optional() }),
  z.object({ action: z.literal('reset_password'), user_id: Id, password: z.string().min(8).max(72) }),
  z.object({ action: z.literal('suspend'), user_id: Id, suspended: z.boolean() }),
  z.object({ action: z.literal('delete'), user_id: Id }),
]);
type Input = z.infer<typeof Body>;

async function setRole(admin: SupabaseClient, userId: string, role: 'admin' | 'user') {
  await admin.from('user_roles').upsert({ user_id: userId, role: 'user' }, { onConflict: 'user_id,role' });
  if (role === 'admin') {
    const { error } = await admin.from('user_roles').upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });
    if (error) throw error;
  } else {
    const { error } = await admin.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    if (error) throw error;
  }
}

async function listUsers(admin: SupabaseClient) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const [{ data: roles }, { data: profiles }, { data: sources }, { data: posts }] = await Promise.all([
    admin.from('user_roles').select('user_id, role'),
    admin.from('profiles').select('id, display_name'),
    admin.from('content_sources').select('user_id'),
    admin.from('generated_posts').select('user_id'),
  ]);
  const count = (rows: { user_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.user_id === id).length;
  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    display_name: profiles?.find((p) => p.id === u.id)?.display_name ?? null,
    role: roles?.some((r) => r.user_id === u.id && r.role === 'admin') ? 'admin' : 'user',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    suspended: !!u.banned_until && new Date(u.banned_until) > new Date(),
    project_count: count(sources, u.id),
    post_count: count(posts, u.id),
  }));
}

async function deleteUser(admin: SupabaseClient, id: string) {
  for (const t of ['post_variants', 'generated_posts', 'content_signals', 'content_sources', 'brand_voice_profiles']) {
    const { error } = await admin.from(t).delete().eq('user_id', id);
    if (error) throw error;
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
}

async function run(admin: SupabaseClient, input: Input): Promise<unknown> {
  switch (input.action) {
    case 'list':
      return { users: await listUsers(admin) };
    case 'create': {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email, password: input.password, email_confirm: true,
        user_metadata: { display_name: input.display_name ?? null },
      });
      if (error) throw error;
      await admin.from('profiles').upsert({ id: data.user.id, display_name: input.display_name ?? null });
      await setRole(admin, data.user.id, input.role);
      return { id: data.user.id };
    }
    case 'update': {
      if (input.email) {
        const { error } = await admin.auth.admin.updateUserById(input.user_id, { email: input.email, email_confirm: true });
        if (error) throw error;
      }
      if (input.display_name !== undefined) {
        const { error } = await admin.from('profiles').upsert({ id: input.user_id, display_name: input.display_name });
        if (error) throw error;
      }
      if (input.role) await setRole(admin, input.user_id, input.role);
      return { ok: true };
    }
    case 'reset_password': {
      const { error } = await admin.auth.admin.updateUserById(input.user_id, { password: input.password });
      if (error) throw error;
      return { ok: true };
    }
    case 'suspend': {
      const { error } = await admin.auth.admin.updateUserById(input.user_id, { ban_duration: input.suspended ? '876000h' : 'none' });
      if (error) throw error;
      return { ok: true };
    }
    case 'delete':
      await deleteUser(admin, input.user_id);
      return { ok: true };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Not signed in' }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401);
  const actorId = userData.user.id;

  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: actorId, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin access required' }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, 400);
  const input = parsed.data;
  const targetId = 'user_id' in input ? input.user_id : null;

  // Prevent an admin from locking themselves (and possibly everyone) out.
  const selfBlocked = targetId === actorId && (input.action === 'delete' || (input.action === 'suspend' && input.suspended) || (input.action === 'update' && input.role === 'user'));
  if (selfBlocked) return json({ error: "You can't delete, suspend, or demote your own account." }, 400);

  const ip = req.headers.get('x-forwarded-for');
  const audit = (outcome: string, details: Record<string, unknown> = {}) =>
    input.action === 'list' ? Promise.resolve() :
    admin.from('admin_audit_log').insert({ actor_id: actorId, action: input.action, target_user_id: targetId, outcome, details, ip }).then(() => undefined);

  try {
    const result = await run(admin, input);
    const created = input.action === 'create' ? { email: input.email, id: (result as { id: string }).id } : {};
    await audit('success', created);
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await audit('failure', { message });
    return json({ error: message }, 400);
  }
});
