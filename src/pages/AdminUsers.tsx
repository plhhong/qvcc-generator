import { useMemo, useState } from 'react';
import { Pencil, Trash2, Ban, CheckCircle2, UserPlus, Search, KeyRound, Eye, EyeOff } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAction, useAdminUsers } from '@/features/admin/use-admin';
import { UserFormDialog } from '@/features/admin/user-form-dialog';
import type { AdminUser } from '@/features/admin/admin-service';

const SetPasswordDialog = ({ user, onClose }: { user: AdminUser | null; onClose: () => void }) => {
  const action = useAdminAction();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!user) return;
    if (password.length < 8) { setError('Use at least 8 characters'); return; }
    await action.mutateAsync({ action: 'reset_password', user_id: user.id, password });
    setPassword('');
    onClose();
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) { setPassword(''); setError(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Set password for {user?.email}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input id="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" className="pr-10"
              value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3"
              aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Existing passwords can't be viewed — they're stored securely as hashes. Setting a new one takes effect immediately.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={action.isPending || !password}>Set password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-CA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Never';

export const AdminUsersPage = () => {
  const { user: me } = useAuth();
  const { data: users = [], isLoading, error } = useAdminUsers();
  const action = useAdminAction();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'all' | 'admin' | 'user'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [pwUser, setPwUser] = useState<AdminUser | null>(null);

  const filtered = useMemo(() => users.filter((u) =>
    (role === 'all' || u.role === role) &&
    (u.email.toLowerCase().includes(search.toLowerCase()) || (u.display_name ?? '').toLowerCase().includes(search.toLowerCase()))
  ), [users, role, search]);

  const openForm = (u: AdminUser | null) => { setEditing(u); setFormOpen(true); };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">Create, edit, suspend, and delete user accounts.</p>
          </div>
          <Button onClick={() => openForm(null)}><UserPlus className="h-4 w-4 mr-2" />Create user</Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by email or name" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="w-40" aria-label="Filter by role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="user">Users</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>
                <TableHead>Projects</TableHead><TableHead>Posts</TableHead><TableHead>Created</TableHead>
                <TableHead>Last sign-in</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading users...</TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={8} className="text-center text-destructive">Couldn't load users: {error.message}</TableCell></TableRow>}
              {!isLoading && !error && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No users match your search.</TableCell></TableRow>
              )}
              {filtered.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{u.display_name || u.email}{isMe && <span className="text-xs text-muted-foreground"> (you)</span>}</p>
                      {u.display_name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                    </TableCell>
                    <TableCell><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role === 'admin' ? 'Admin' : 'User'}</Badge></TableCell>
                    <TableCell><Badge variant={u.suspended ? 'destructive' : 'outline'}>{u.suspended ? 'Suspended' : 'Active'}</Badge></TableCell>
                    <TableCell>{u.project_count}</TableCell>
                    <TableCell>{u.post_count}</TableCell>
                    <TableCell>{fmt(u.created_at)}</TableCell>
                    <TableCell>{fmt(u.last_sign_in_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" aria-label="Edit user" onClick={() => openForm(u)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Set password" onClick={() => setPwUser(u)}><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={isMe} aria-label={u.suspended ? 'Reactivate user' : 'Suspend user'}
                        onClick={() => action.mutate({ action: 'suspend', user_id: u.id, suspended: !u.suspended })}>
                        {u.suspended ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" disabled={isMe} aria-label="Delete user" className="text-destructive" onClick={() => setDeleting(u)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
      <SetPasswordDialog user={pwUser} onClose={() => setPwUser(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.email} and all of their projects, analyses, and posts will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && action.mutate({ action: 'delete', user_id: deleting.id })}>
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};
