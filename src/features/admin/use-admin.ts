import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { listAdminUsers, runAdminAction, type AdminAction } from './admin-service';

export const useIsAdmin = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles').select('role').eq('user_id', user!.id).eq('role', 'admin').maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
};

export const useAdminUsers = () => useQuery({ queryKey: ['admin-users'], queryFn: listAdminUsers });

const successText: Record<AdminAction['action'], string> = {
  create: 'User created',
  update: 'User updated',
  reset_password: 'Password reset',
  suspend: 'Access updated',
  delete: 'User deleted',
};

export const useAdminAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runAdminAction,
    onSuccess: (_, vars) => {
      toast.success(successText[vars.action]);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Something went wrong. Please try again.'),
  });
};
