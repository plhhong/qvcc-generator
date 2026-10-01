import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useIsAdmin } from './use-admin';

const AdminGate = ({ children }: { children: React.ReactNode }) => {
  const { data: isAdmin, isLoading } = useIsAdmin();
  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AdminGate>{children}</AdminGate></ProtectedRoute>
);
