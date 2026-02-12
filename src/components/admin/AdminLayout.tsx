"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase-client";
import { ACADEMIA_INFO } from "@/lib/constants";
import {
    LayoutDashboard,
    Users,
    LogOut,
    Menu,
    X,
    ChevronRight,
} from "lucide-react";

interface AdminLayoutProps {
    children: React.ReactNode;
}

const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/registros", label: "Registros", icon: Users },
];

export default function AdminPanelLayout({ children }: AdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [userName, setUserName] = useState("");
    const [userRole, setUserRole] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        async function loadUser() {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                const { data: adminUser } = await supabase
                    .from("admin_users")
                    .select("nombre, rol")
                    .eq("user_id", user.id)
                    .single();

                if (adminUser) {
                    setUserName(adminUser.nombre);
                    setUserRole(adminUser.rol);
                } else {
                    setUserName(user.email || "");
                }
            }
        }
        loadUser();
    }, []);

    async function handleLogout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/admin/login");
        router.refresh();
    }

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "admin":
                return "Administrador";
            case "editor":
                return "Editor";
            default:
                return "Visualizador";
        }
    };

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case "admin":
                return "bg-primary-50 text-primary border border-primary/20";
            case "editor":
                return "bg-blue-50 text-blue-600 border border-blue-200";
            default:
                return "bg-gray-100 text-gray-600 border border-gray-200";
        }
    };

    // Obtener iniciales del usuario
    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <Menu className="w-5 h-5 text-gray-600" />
                </button>
                <Image
                    src={ACADEMIA_INFO.logo}
                    alt="Logo"
                    width={100}
                    height={40}
                />
                <div className="w-9" />
            </div>

            {/* Sidebar overlay mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full w-[272px] bg-white border-r border-gray-200 z-50 
        transform transition-transform duration-300 flex flex-col
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
            >
                {/* Logo section */}
                <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Image
                                src={ACADEMIA_INFO.logo}
                                alt="Academia Danas"
                                width={110}
                                height={45}
                            />
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5 font-medium tracking-wide uppercase">
                        Panel Administrativo
                    </p>
                </div>

                {/* User info */}
                <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                                {getInitials(userName || "U")}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-700 text-sm truncate">
                                {userName}
                            </p>
                            <span
                                className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold ${getRoleBadgeClass(userRole)}`}
                            >
                                {getRoleLabel(userRole)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Menú
                    </p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                  ${
                      isActive
                          ? "bg-gradient-to-r from-primary to-primary-dark text-white shadow-md shadow-primary/20"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        className={`w-[18px] h-[18px] ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"}`}
                                    />
                                    {item.label}
                                </div>
                                {isActive && (
                                    <ChevronRight className="w-4 h-4 text-white/70" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-3 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              text-red-500 hover:bg-red-50 transition-all group"
                    >
                        <LogOut className="w-[18px] h-[18px] text-red-400 group-hover:text-red-500" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="lg:ml-[272px] min-h-screen">
                <div className="p-5 lg:p-8 max-w-7xl mx-auto">{children}</div>
            </main>
        </div>
    );
}
