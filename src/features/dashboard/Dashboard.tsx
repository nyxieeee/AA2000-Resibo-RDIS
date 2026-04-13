import { useAuthStore } from '../../store/useAuthStore';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { MemberDashboard } from './MemberDashboard';

export function Dashboard() {
  const user = useAuthStore(state => state.user);

  // Provide the dedicated Executive views for C-level roles
  if (user?.role === 'CEO' || user?.role === 'President' || user?.role === 'General Manager') {
    return <ExecutiveDashboard />;
  }

  // Account and generic members get the workflow-operational dashboard
  return <MemberDashboard />;
}
