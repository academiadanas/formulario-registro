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
    sinAcceso: boolean;
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
        sinAcceso: false,
    });

    useEffect(() => {
        async function load() {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setInfo((prev) => ({
                    ...prev,
                    loading: false,
                    sinAcceso: true,
                }));
                return;
            }

            // 1. Verificar acceso centralizado
            const { data: acceso } = await supabase.rpc(
                "verificar_acceso_app",
                {
                    app_slug: "inscripciones",
                },
            );

            if (acceso?.tiene_acceso) {
                const rol = acceso.rol;
                setInfo({
                    userId: user.id,
                    email: user.email || "",
                    nombre: acceso.nombre || "",
                    rol,
                    isAdmin: rol === "admin",
                    isEditor: rol === "editor" || rol === "capturista",
                    isViewer: rol === "viewer" || rol === "solo_lectura",
                    canEdit:
                        rol === "admin" ||
                        rol === "editor" ||
                        rol === "capturista",
                    canDelete: rol === "admin",
                    canExport:
                        rol === "admin" ||
                        rol === "editor" ||
                        rol === "capturista",
                    canManageUsers: rol === "admin",
                    loading: false,
                    sinAcceso: false,
                });
                return;
            }

            // Sin acceso centralizado
            setInfo((prev) => ({ ...prev, loading: false, sinAcceso: true }));
        }
        load();
    }, []);

    return info;
}
