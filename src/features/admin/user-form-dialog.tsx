import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminUser } from './admin-service';
import { useAdminAction } from './use-admin';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email').max(255),
  display_name: z.string().trim().max(100),
  role: z.enum(['admin', 'user']),
  password: z.string().max(72).refine((v) => v === '' || v.length >= 8, 'Use at least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
}

export const UserFormDialog = ({ open, onOpenChange, user }: Props) => {
  const action = useAdminAction();
  const isEdit = !!user;
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', display_name: '', role: 'user', password: '' },
  });

  useEffect(() => {
    if (open) form.reset({ email: user?.email ?? '', display_name: user?.display_name ?? '', role: user?.role ?? 'user', password: '' });
  }, [open, user, form]);

  const onSubmit = async (v: FormValues) => {
    if (!isEdit) {
      if (!v.password) { form.setError('password', { message: 'Password is required' }); return; }
      await action.mutateAsync({ action: 'create', email: v.email, password: v.password, display_name: v.display_name || undefined, role: v.role });
    } else {
      await action.mutateAsync({
        action: 'update', user_id: user.id,
        email: v.email !== user.email ? v.email : undefined,
        display_name: v.display_name, role: v.role !== user.role ? v.role : undefined,
      });
      if (v.password) await action.mutateAsync({ action: 'reset_password', user_id: user.id, password: v.password });
    }
    onOpenChange(false);
  };

  const err = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Edit user' : 'Create user'}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {err.email && <p className="text-xs text-destructive">{err.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" {...form.register('display_name')} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Controller control={form.control} name="role" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{isEdit ? 'New password (leave blank to keep current)' : 'Password'}</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="pr-10" {...form.register('password')} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3"
                aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {err.password && <p className="text-xs text-destructive">{err.password.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={action.isPending}>{isEdit ? 'Save changes' : 'Create user'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
