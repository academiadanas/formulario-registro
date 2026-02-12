import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";

interface UserInfo {
    userId: string;
    email: string;
    nombre: string;
    rol: string;
    isAdmin: boolean;
    isEditor: boolean;
    isViewer: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canExport: boolean;
    canManageUsers: boolean;
    loading: boolean;
}

export function useUserRole(): UserInfo {
    const [info, setInfo] = useState<UserInfo>({
        userId: "",
        email: "",
        nombre: "",
        rol: "",
        isAdmin: false,
        isEditor: false,
        isViewer: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
        canManageUsers: false,
        loading: true,
    });

    useEffect(() => {
        async function load() {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setInfo((prev) => ({ ...prev, loading: false }));
                return;
            }

            const { data: adminUser } = await supabase
                .from("admin_users")
                .select("nombre, rol, email")
                .eq("user_id", user.id)
                .single();

            const rol = adminUser?.rol || "viewer";

            setInfo({
                userId: user.id,
                email: adminUser?.email || user.email || "",
                nombre: adminUser?.nombre || "",
                rol,
                isAdmin: rol === "admin",
                isEditor: rol === "editor",
                isViewer: rol === "viewer",
                canEdit: rol === "admin" || rol === "editor",
                canDelete: rol === "admin",
                canExport: rol === "admin" || rol === "editor",
                canManageUsers: rol === "admin",
                loading: false,
            });
        }
        load();
    }, []);

    return info;
}
