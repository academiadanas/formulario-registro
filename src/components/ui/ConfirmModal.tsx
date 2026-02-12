"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "danger",
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    // Cerrar con Escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape" && isOpen && !loading) {
                onCancel();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, loading, onCancel]);

    // Bloquear scroll del body
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: "bg-red-100",
            iconColor: "text-red-500",
            buttonBg: "bg-red-500 hover:bg-red-600",
        },
        warning: {
            iconBg: "bg-amber-100",
            iconColor: "text-amber-500",
            buttonBg: "bg-amber-500 hover:bg-amber-600",
        },
        info: {
            iconBg: "bg-blue-100",
            iconColor: "text-blue-500",
            buttonBg: "bg-blue-500 hover:bg-blue-600",
        },
    };

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!loading ? onCancel : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-[modalIn_0.2s_ease]">
                {/* Botón cerrar */}
                <button
                    onClick={onCancel}
                    disabled={loading}
                    className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Ícono */}
                <div className="flex justify-center mb-4">
                    <div
                        className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center`}
                    >
                        <AlertTriangle
                            className={`w-7 h-7 ${styles.iconColor}`}
                        />
                    </div>
                </div>

                {/* Contenido */}
                <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        {title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Botones */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${styles.buttonBg} transition-all disabled:opacity-50`}
                    >
                        {loading ? (
                            <span className="inline-flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Procesando...
                            </span>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
