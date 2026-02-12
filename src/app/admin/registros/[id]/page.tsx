"use client";

import EditRegistroModal from "@/components/admin/EditRegistroModal";
import { Pencil } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Registro } from "@/types";
import {
    ArrowLeft,
    FileText,
    Mail,
    MessageCircle,
    Trash2,
    User,
    MapPin,
    Users,
    Phone,
    GraduationCap,
    CheckCircle2,
    XCircle,
    Loader2,
    Calendar,
    Hash,
} from "lucide-react";

export default function AdminRegistroDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const [registro, setRegistro] = useState<Registro | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState("");
    const [actionResult, setActionResult] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        async function loadRegistro() {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("registros")
                .select("*")
                .eq("id", parseInt(id))
                .single();

            if (error || !data) {
                router.push("/admin/registros");
                return;
            }
            setRegistro(data as Registro);
            setLoading(false);
        }
        loadRegistro();
    }, [id, router]);

    async function handleSendEmail() {
        setActionLoading("email");
        setActionResult(null);
        try {
            const res = await fetch(`/api/pdf/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "send" }),
            });
            const data = await res.json();
            if (data.emailSent) {
                setActionResult({
                    type: "success",
                    message: `Correo enviado exitosamente a ${data.correoEnviado}`,
                });
            } else {
                setActionResult({
                    type: "error",
                    message: data.emailError || "No se pudo enviar el correo",
                });
            }
        } catch {
            setActionResult({ type: "error", message: "Error de conexión" });
        } finally {
            setActionLoading("");
        }
    }

    async function handleDelete() {
        setDeleteLoading(true);
        const supabase = createClient();
        const { error } = await supabase
            .from("registros")
            .delete()
            .eq("id", parseInt(id));

        if (error) {
            setActionResult({
                type: "error",
                message: "Error al eliminar: " + error.message,
            });
            setDeleteLoading(false);
            setShowDeleteModal(false);
        } else {
            router.push("/admin/registros");
        }
    }

    function formatDate(dateStr: string | null) {
        if (!dateStr) return "—";
        try {
            return new Date(dateStr).toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    }

    function formatDateTime(dateStr: string | null) {
        if (!dateStr) return "—";
        try {
            return new Date(dateStr).toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">
                        Cargando registro...
                    </p>
                </div>
            </div>
        );
    }

    if (!registro) return null;

    const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`;
    const whatsappLink = `https://wa.me/52${registro.telefono_celular}`;
    const docsCount = [
        registro.ruta_ine,
        registro.ruta_acta_nacimiento,
        registro.ruta_comprobante_domicilio,
    ].filter(Boolean).length;

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <Link
                    href="/admin/registros"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary transition-colors mb-3"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a registros
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
                            <span className="text-white text-lg font-bold">
                                {registro.nombre[0]}
                                {registro.apellido_paterno[0]}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">
                                {nombreCompleto}
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary-50 px-2.5 py-0.5 rounded-full">
                                    <Hash className="w-3 h-3" />
                                    Folio {registro.id}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                    <Calendar className="w-3 h-3" />
                                    {formatDateTime(registro.fecha_registro)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Estado de documentos */}
                    <div
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            ${
                docsCount === 3
                    ? "bg-green-50 text-green-600 border border-green-200"
                    : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}
                    >
                        {docsCount === 3 ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <XCircle className="w-4 h-4" />
                        )}
                        Documentos: {docsCount}/3
                    </div>
                </div>
            </div>

            {/* Action result */}
            {actionResult && (
                <div
                    className={`mb-6 p-4 rounded-xl border text-sm flex items-center gap-3 animate-[fadeIn_0.3s_ease]
          ${
              actionResult.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
          }`}
                >
                    {actionResult.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    ) : (
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    {actionResult.message}
                </div>
            )}

            {/* Acciones */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <div className="flex flex-wrap gap-3">
                    <a
                        href={`/api/pdf/${id}`}
                        target="_blank"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                        <FileText className="w-4 h-4" />
                        Ver PDF
                    </a>

                    <button
                        onClick={handleSendEmail}
                        disabled={actionLoading === "email"}
                        className="inline-flex items-center gap-2 bg-blue-500 text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        {actionLoading === "email" ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />{" "}
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Mail className="w-4 h-4" /> Enviar Correo
                            </>
                        )}
                    </button>

                    <a
                        href={whatsappLink}
                        target="_blank"
                        className="inline-flex items-center gap-2 bg-[#25d366] text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                    </a>

                    <button
                        onClick={() => setShowEditModal(true)}
                        className="inline-flex items-center gap-2 bg-amber-500 text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                        <Pencil className="w-4 h-4" />
                        Editar
                    </button>

                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="inline-flex items-center gap-2 bg-white border border-red-200 text-red-500 py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all ml-auto"
                    >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                    </button>
                </div>
            </div>

            {/* Datos en grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Datos Personales */}
                <SectionCard icon={User} title="Datos Personales">
                    <DataRow label="Nombre completo" value={nombreCompleto} />
                    <DataRow
                        label="Correo electrónico"
                        value={registro.correo_electronico}
                    />
                    <DataRow
                        label="Teléfono celular"
                        value={registro.telefono_celular}
                    />
                    <DataRow
                        label="Estado civil"
                        value={registro.estado_civil}
                    />
                    <DataRow
                        label="Grado de estudios"
                        value={registro.grado_estudios}
                    />
                    <DataRow
                        label="Fecha de nacimiento"
                        value={formatDate(registro.fecha_nacimiento)}
                    />
                    <DataRow
                        label="País de nacimiento"
                        value={registro.pais_nacimiento}
                    />
                    <DataRow
                        label="Estado de nacimiento"
                        value={registro.estado_nacimiento}
                    />
                    <DataRow
                        label="Municipio de nacimiento"
                        value={registro.municipio_nacimiento}
                    />
                </SectionCard>

                {/* Domicilio */}
                <SectionCard icon={MapPin} title="Domicilio">
                    <DataRow
                        label="Dirección"
                        value={`${registro.calle_domicilio} #${registro.numero_exterior}${registro.numero_interior ? " Int. " + registro.numero_interior : ""}`}
                    />
                    <DataRow
                        label="Colonia"
                        value={registro.colonia_domicilio}
                    />
                    <DataRow
                        label="Código postal"
                        value={registro.codigo_postal}
                    />
                    <DataRow label="País" value={registro.pais_domicilio} />
                    <DataRow label="Estado" value={registro.estado_domicilio} />
                    <DataRow
                        label="Municipio"
                        value={registro.municipio_domicilio}
                    />
                </SectionCard>

                {/* Contacto Familiar */}
                <SectionCard icon={Users} title="Contacto Familiar">
                    <DataRow label="Nombre" value={registro.familiar_nombre} />
                    <DataRow
                        label="Parentesco"
                        value={registro.familiar_parentesco}
                    />
                    <DataRow
                        label="Teléfono"
                        value={registro.familiar_telefono}
                    />
                    <DataRow
                        label="Dirección"
                        value={
                            registro.familiar_calle
                                ? `${registro.familiar_calle} #${registro.familiar_numero || "S/N"}, Col. ${registro.familiar_colonia || ""}`
                                : null
                        }
                    />
                    <DataRow
                        label="Código postal"
                        value={registro.familiar_codigo_postal}
                    />
                    <DataRow label="Estado" value={registro.familiar_estado} />
                    <DataRow
                        label="Municipio"
                        value={registro.familiar_municipio}
                    />
                </SectionCard>

                {/* Contacto de Emergencia */}
                <SectionCard icon={Phone} title="Contacto de Emergencia">
                    <DataRow
                        label="Nombre"
                        value={registro.emergencia_nombre}
                    />
                    <DataRow
                        label="Parentesco"
                        value={registro.emergencia_parentesco}
                    />
                    <DataRow
                        label="Teléfono"
                        value={registro.emergencia_telefono}
                    />
                </SectionCard>

                {/* Curso y Documentos */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                            <GraduationCap className="w-[18px] h-[18px] text-purple-500" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-700">
                            Curso y Documentos
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <DataRow
                                label="Curso inscrito"
                                value={registro.curso}
                            />
                            <DataRow
                                label="Fecha de registro"
                                value={formatDateTime(registro.fecha_registro)}
                            />
                        </div>

                        <div className="space-y-3">
                            <DocRow
                                label="INE / CURP"
                                uploaded={!!registro.ruta_ine}
                            />
                            <DocRow
                                label="Acta de Nacimiento"
                                uploaded={!!registro.ruta_acta_nacimiento}
                            />
                            <DocRow
                                label="Comprobante de Domicilio"
                                uploaded={!!registro.ruta_comprobante_domicilio}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {/* Modal de edición */}
            {registro && (
                <EditRegistroModal
                    isOpen={showEditModal}
                    registro={registro}
                    onClose={() => setShowEditModal(false)}
                    onSaved={(updated) => setRegistro(updated)}
                />
            )}

            {/* Modal de confirmación */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Eliminar Registro"
                message={`¿Estás seguro de eliminar el registro de ${nombreCompleto}? Esta acción no se puede deshacer y se perderán todos los datos y documentos asociados.`}
                confirmLabel="Sí, Eliminar"
                cancelLabel="No, Cancelar"
                variant="danger"
                loading={deleteLoading}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
}

// Componente de sección con ícono
function SectionCard({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    children: React.ReactNode;
}) {
    const colorMap: Record<string, { bg: string; icon: string }> = {
        "Datos Personales": { bg: "bg-primary-50", icon: "text-primary" },
        Domicilio: { bg: "bg-blue-50", icon: "text-blue-500" },
        "Contacto Familiar": { bg: "bg-green-50", icon: "text-green-500" },
        "Contacto de Emergencia": { bg: "bg-amber-50", icon: "text-amber-500" },
    };

    const colors = colorMap[title] || {
        bg: "bg-gray-50",
        icon: "text-gray-500",
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                <div
                    className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center`}
                >
                    <Icon className={`w-[18px] h-[18px] ${colors.icon}`} />
                </div>
                <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
            </div>
            <dl className="space-y-3">{children}</dl>
        </div>
    );
}

// Fila de dato
function DataRow({
    label,
    value,
}: {
    label: string;
    value: string | null | undefined;
}) {
    return (
        <div className="flex justify-between items-start gap-4">
            <dt className="text-sm text-gray-400 flex-shrink-0">{label}</dt>
            <dd className="text-sm text-gray-800 font-medium text-right">
                {value || "—"}
            </dd>
        </div>
    );
}

// Fila de documento con indicador visual
function DocRow({ label, uploaded }: { label: string; uploaded: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-400">{label}</span>
            {uploaded ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Subido
                </span>
            ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                    <XCircle className="w-3.5 h-3.5" />
                    Pendiente
                </span>
            )}
        </div>
    );
}
