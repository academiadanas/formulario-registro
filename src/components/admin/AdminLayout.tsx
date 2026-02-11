'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { ACADEMIA_INFO } from '@/lib/constants';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminPanelLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Obtener datos del admin
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('nombre, rol')
          .eq('user_id', user.id)
          .single();

        if (adminUser) {
          setUserName(adminUser.nombre);
          setUserRole(adminUser.rol);
        } else {
          setUserName(user.email || '');
        }
      }
    }
    loadUser();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/registros', label: 'Registros', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile header */}
      <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Image src={ACADEMIA_INFO.logo} alt="Logo" width={100} height={40} />
        <div className="w-10" />
      </div>

      {/* Sidebar overlay mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6 border-b border-gray-100">
          <Image
            src={ACADEMIA_INFO.logo}
            alt="Academia Danas"
            width={120}
            height={50}
            className="mx-auto"
          />
          <p className="text-center text-xs text-gray-400 mt-2">Panel Administrativo</p>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-700 text-sm">{userName}</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium
            ${userRole === 'admin' ? 'bg-primary-50 text-primary' : 'bg-blue-50 text-blue-600'}`}>
            {userRole === 'admin' ? 'Administrador' : userRole === 'editor' ? 'Editor' : 'Visualizador'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                ${pathname === item.href
                  ? 'bg-primary-50 text-primary'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
              text-red-500 hover:bg-red-50 transition-all"
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
