"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import {
    Shield,
    UserPlus,
    Pencil,
    Trash2,
    X,
    Save,
    Loader2,
    CheckCircle2,
    XCircle,
    Eye,
    Users,
    ShieldCheck,
    ShieldAlert,
} from "lucide-react";

interface AdminUser {
    id: number;
    user_id: string;
    email: string;
    nombre: string;
    rol: string;
    activo: boolean;
    created_at: string;
}

export default function AdminUsuariosPage() {
    const router = useRouter();
    const currentUser = useUserRole();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [actionResult, setActionResult] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<AdminUser | null>(
        null,
    );
    const [deleteLoading, setDeleteLoading] = useState(false);

    const loadUsers = useCallback(async () => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("admin_users")
            .select("*")
            .order("created_at", { ascending: true });

        if (!error && data) {
            setUsers(data as AdminUser[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!currentUser.loading && !currentUser.canManageUsers) {
            router.push("/admin");
            return;
        }
        loadUsers();
    }, [currentUser.loading, currentUser.canManageUsers, router, loadUsers]);

    async function handleToggleActive(user: AdminUser) {
        const supabase = createClient();
        const { error } = await supabase
            .from("admin_users")
            .update({ activo: !user.activo })
            .eq("id", user.id);

        if (!error) {
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === user.id ? { ...u, activo: !u.activo } : u,
                ),
            );
            setActionResult({
                type: "success",
                message: `Usuario ${!user.activo ? "activado" : "desactivado"} correctamente`,
            });
        } else {
            setActionResult({
                type: "error",
                message: "Error al actualizar usuario",
            });
        }
        setTimeout(() => setActionResult(null), 3000);
    }

    async function handleDelete(user: AdminUser) {
        setDeleteLoading(true);
        const supabase = createClient();
        const { error } = await supabase
            .from("admin_users")
            .delete()
            .eq("id", user.id);

        if (!error) {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            setActionResult({
                type: "success",
                message: "Usuario eliminado correctamente",
            });
        } else {
            setActionResult({
                type: "error",
                message: "Error al eliminar: " + error.message,
            });
        }
        setDeleteLoading(false);
        setShowDeleteModal(null);
        setTimeout(() => setActionResult(null), 3000);
    }

    function getRoleIcon(rol: string) {
        switch (rol) {
            case "admin":
                return <ShieldCheck className="w-4 h-4 text-primary" />;
            case "editor":
                return <Pencil className="w-4 h-4 text-blue-500" />;
            default:
                return <Eye className="w-4 h-4 text-gray-400" />;
        }
    }

    function getRoleBadge(rol: string) {
        switch (rol) {
            case "admin":
                return "bg-primary-50 text-primary border border-primary/20";
            case "editor":
                return "bg-blue-50 text-blue-600 border border-blue-200";
            default:
                return "bg-gray-100 text-gray-600 border border-gray-200";
        }
    }

    function getRoleLabel(rol: string) {
        switch (rol) {
            case "admin":
                return "Administrador";
            case "editor":
                return "Editor";
            default:
                return "Visualizador";
        }
    }

    if (currentUser.loading || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">
                        Cargando usuarios...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        Gestión de Usuarios
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Administra los accesos y permisos del panel
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setShowModal(true);
                    }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white
            py-2.5 px-5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
                >
                    <UserPlus className="w-4 h-4" />
                    Agregar Usuario
                </button>
            </div>

            {/* Resultado de acción */}
            {actionResult && (
                <div
                    className={`mb-6 p-4 rounded-xl border text-sm flex items-center gap-3 animate-[fadeIn_0.3s_ease]
          ${actionResult.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}
                >
                    {actionResult.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5" />
                    ) : (
                        <XCircle className="w-5 h-5" />
                    )}
                    {actionResult.message}
                </div>
            )}

            {/* Info de roles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">
                            Administrador
                        </p>
                        <p className="text-xs text-gray-400">
                            Acceso total al sistema
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Pencil className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">
                            Editor
                        </p>
                        <p className="text-xs text-gray-400">
                            Puede editar y exportar
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                        <Eye className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">
                            Visualizador
                        </p>
                        <p className="text-xs text-gray-400">Solo lectura</p>
                    </div>
                </div>
            </div>

            {/* Tabla de usuarios */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                    Usuario
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                    Email
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                    Rol
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                    Estado
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr
                                    key={user.id}
                                    className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
                                >
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
                                                <span className="text-white text-xs font-bold">
                                                    {user.nombre
                                                        .split(" ")
                                                        .map((n) => n[0])
                                                        .join("")
                                                        .toUpperCase()
                                                        .slice(0, 2)}
                                                </span>
                                            </div>
                                            <p className="font-medium text-gray-800 text-sm">
                                                {user.nombre}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <p className="text-sm text-gray-500">
                                            {user.email}
                                        </p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${getRoleBadge(user.rol)}`}
                                        >
                                            {getRoleIcon(user.rol)}
                                            {getRoleLabel(user.rol)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <button
                                            onClick={() =>
                                                handleToggleActive(user)
                                            }
                                            disabled={
                                                user.user_id ===
                                                currentUser.userId
                                            }
                                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer
                        ${
                            user.activo
                                ? "bg-green-50 text-green-600 hover:bg-green-100"
                                : "bg-red-50 text-red-500 hover:bg-red-100"
                        }
                        ${user.user_id === currentUser.userId ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            {user.activo ? (
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            ) : (
                                                <XCircle className="w-3.5 h-3.5" />
                                            )}
                                            {user.activo
                                                ? "Activo"
                                                : "Inactivo"}
                                        </button>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingUser(user);
                                                    setShowModal(true);
                                                }}
                                                className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            {user.user_id !==
                                                currentUser.userId && (
                                                <button
                                                    onClick={() =>
                                                        setShowDeleteModal(user)
                                                    }
                                                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal crear/editar usuario */}
            {showModal && (
                <UserFormModal
                    user={editingUser}
                    onClose={() => {
                        setShowModal(false);
                        setEditingUser(null);
                    }}
                    onSaved={() => {
                        setShowModal(false);
                        setEditingUser(null);
                        loadUsers();
                        setActionResult({
                            type: "success",
                            message: editingUser
                                ? "Usuario actualizado"
                                : "Usuario agregado correctamente",
                        });
                        setTimeout(() => setActionResult(null), 3000);
                    }}
                />
            )}

            {/* Modal confirmar eliminación */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() =>
                            !deleteLoading && setShowDeleteModal(null)
                        }
                    />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                <ShieldAlert className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">
                                Eliminar Usuario
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            ¿Estás seguro de eliminar a{" "}
                            <strong>{showDeleteModal.nombre}</strong> del panel
                            administrativo? El usuario ya no podrá acceder al
                            sistema.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                disabled={deleteLoading}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteModal)}
                                disabled={deleteLoading}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all"
                            >
                                {deleteLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Modal de formulario para crear/editar usuario
function UserFormModal({
    user,
    onClose,
    onSaved,
}: {
    user: AdminUser | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [email, setEmail] = useState(user?.email || "");
    const [nombre, setNombre] = useState(user?.nombre || "");
    const [rol, setRol] = useState(user?.rol || "viewer");
    const [password, setPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit() {
        setSaving(true);
        setError("");

        if (!email || !nombre) {
            setError("Email y nombre son obligatorios");
            setSaving(false);
            return;
        }

        const supabase = createClient();

        if (user) {
            // Editar usuario existente
            const { error: updateError } = await supabase
                .from("admin_users")
                .update({ nombre, rol })
                .eq("id", user.id);

            if (updateError) {
                setError("Error al actualizar: " + updateError.message);
                setSaving(false);
                return;
            }
        } else {
            // Crear nuevo usuario - primero verificar si ya existe en auth
            if (!password || password.length < 6) {
                setError("La contraseña debe tener al menos 6 caracteres");
                setSaving(false);
                return;
            }

            // Crear usuario en auth via API
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, nombre, rol }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Error al crear usuario");
                setSaving(false);
                return;
            }
        }

        setSaving(false);
        onSaved();
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!saving ? onClose : undefined}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">
                        {user ? "Editar Usuario" : "Agregar Usuario"}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">
                            Nombre completo
                        </label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-50 transition-all"
                            placeholder="Ej: María García"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">
                            Correo electrónico
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={!!user}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-50 transition-all disabled:bg-gray-50 disabled:text-gray-400"
                            placeholder="correo@ejemplo.com"
                        />
                    </div>

                    {!user && (
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-50 transition-all"
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">
                            Rol
                        </label>
                        <select
                            value={rol}
                            onChange={(e) => setRol(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-50 transition-all"
                        >
                            <option value="admin">
                                Administrador — Acceso total
                            </option>
                            <option value="editor">
                                Editor — Puede editar y exportar
                            </option>
                            <option value="viewer">
                                Visualizador — Solo lectura
                            </option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-primary-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {user ? "Guardar Cambios" : "Crear Usuario"}
                    </button>
                </div>
            </div>
        </div>
    );
}
