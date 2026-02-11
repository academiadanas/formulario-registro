'use client';

import { usePathname } from 'next/navigation';
import AdminPanelLayout from '@/components/admin/AdminLayout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // No aplicar layout admin en la página de login
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return <AdminPanelLayout>{children}</AdminPanelLayout>;
}
