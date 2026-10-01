import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string().nullable(),
  role: z.enum(['admin', 'user']),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  suspended: z.boolean(),
  project_count: z.number(),
  post_count: z.number(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AppRole = AdminUser['role'];

export type AdminAction =
  | { action: 'create'; email: string; password: string; display_name?: string; role: AppRole }
  | { action: 'update'; user_id: string; email?: string; display_name?: string; role?: AppRole }
  | { action: 'reset_password'; user_id: string; password: string }
  | { action: 'suspend'; user_id: string; suspended: boolean }
  | { action: 'delete'; user_id: string };

const invoke = async (body: { action: 'list' } | AdminAction): Promise<unknown> => {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    const ctx: unknown = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const parsed: unknown = await ctx.json().catch(() => null);
      const msg = z.object({ error: z.string() }).safeParse(parsed);
      if (msg.success) throw new Error(msg.data.error);
    }
    throw error;
  }
  return data;
};

export const listAdminUsers = async (): Promise<AdminUser[]> => {
  const data = await invoke({ action: 'list' });
  return z.object({ users: z.array(adminUserSchema) }).parse(data).users;
};

export const runAdminAction = async (body: AdminAction): Promise<void> => {
  await invoke(body);
};
