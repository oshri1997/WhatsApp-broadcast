import { getAdminOverview } from '@/lib/server/adminOverview';
import { AdminOverviewProvider } from './admin-overview-provider';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminOverviewProvider initialOverview={getAdminOverview()}>{children}</AdminOverviewProvider>;
}
