"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";
import { Registro } from "@/types";
import { X, Save, Loader2, Upload, CheckCircle2 } from "lucide-react";

interface EditRegistroModalProps {
    isOpen: boolean;
    registro: Registro;
    onClose: () => void;
    onSaved: (updated: Registro) => void;
}

export default function EditRegistroModal({
    isOpen,
    registro,
    onClose,
    onSaved,
}: EditRegistroModalProps) {
    const [form, setForm] = useState<Registro>(registro);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [activeTab, setActiveTab] = useState("personal");
    const [uploadingFile, setUploadingFile] = useState("");

    useEffect(() => {
        setForm(registro);
        setError("");
        setSuccess("");
        setActiveTab("personal");
    }, [registro, isOpen]);

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

    function handleChange(field: keyof Registro, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleFileUpload(
        field:
            | "ruta_ine"
            | "ruta_acta_nacimiento"
            | "ruta_comprobante_domicilio",
        file: File,
    ) {
        setUploadingFile(field);
        setError("");

        const supabase = createClient();
        const ext = file.name.split(".").pop();
        const fileName = `${registro.id}/${field}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("documentos")
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            setError(`Error al subir archivo: ${uploadError.message}`);
            setUploadingFile("");
            return;
        }

        const { data: urlData } = supabase.storage
            .from("documentos")
            .getPublicUrl(fileName);

        setForm((prev) => ({ ...prev, [field]: urlData.publicUrl }));
        setUploadingFile("");
    }

    async function handleSave() {
        setSaving(true);
        setError("");
        setSuccess("");

        const supabase = createClient();

        const updateData = {
            nombre: form.nombre,
            apellido_paterno: form.apellido_paterno,
            apellido_materno: form.apellido_materno,
            telefono_celular: form.telefono_celular,
            correo_electronico: form.correo_electronico,
            estado_civil: form.estado_civil,
            grado_estudios: form.grado_estudios,
            fecha_nacimiento: form.fecha_nacimiento,
            pais_nacimiento: form.pais_nacimiento,
            estado_nacimiento: form.estado_nacimiento,
            municipio_nacimiento: form.municipio_nacimiento,
            calle_domicilio: form.calle_domicilio,
            numero_exterior: form.numero_exterior,
            numero_interior: form.numero_interior,
            colonia_domicilio: form.colonia_domicilio,
            codigo_postal: form.codigo_postal,
            pais_domicilio: form.pais_domicilio,
            estado_domicilio: form.estado_domicilio,
            municipio_domicilio: form.municipio_domicilio,
            familiar_nombre: form.familiar_nombre,
            familiar_parentesco: form.familiar_parentesco,
            familiar_telefono: form.familiar_telefono,
            familiar_calle: form.familiar_calle,
            familiar_numero: form.familiar_numero,
            familiar_colonia: form.familiar_colonia,
            familiar_codigo_postal: form.familiar_codigo_postal,
            familiar_estado: form.familiar_estado,
            familiar_municipio: form.familiar_municipio,
            emergencia_nombre: form.emergencia_nombre,
            emergencia_parentesco: form.emergencia_parentesco,
            emergencia_telefono: form.emergencia_telefono,
            curso: form.curso,
            ruta_ine: form.ruta_ine,
            ruta_acta_nacimiento: form.ruta_acta_nacimiento,
            ruta_comprobante_domicilio: form.ruta_comprobante_domicilio,
        };

        const { data, error: updateError } = await supabase
            .from("registros")
            .update(updateData)
            .eq("id", registro.id)
            .select()
            .single();

        if (updateError) {
            setError("Error al guardar: " + updateError.message);
        } else {
            setSuccess("Registro actualizado correctamente");
            onSaved(data as Registro);
            setTimeout(() => onClose(), 1500);
        }
        setSaving(false);
    }

    if (!isOpen) return null;

    const tabs = [
        { id: "personal", label: "Datos Personales" },
        { id: "domicilio", label: "Domicilio" },
        { id: "familiar", label: "Contacto Familiar" },
        { id: "emergencia", label: "Emergencia" },
        { id: "curso", label: "Curso y Docs" },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!saving ? onClose : undefined}
            />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-[modalIn_0.2s_ease]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-800">
                        Editar Registro #{registro.id}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-5 pt-4 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? "bg-primary-50 text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> {success}
                        </div>
                    )}

                    {activeTab === "personal" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Nombre"
                                value={form.nombre}
                                onChange={(v) => handleChange("nombre", v)}
                            />
                            <Field
                                label="Apellido Paterno"
                                value={form.apellido_paterno}
                                onChange={(v) =>
                                    handleChange("apellido_paterno", v)
                                }
                            />
                            <Field
                                label="Apellido Materno"
                                value={form.apellido_materno}
                                onChange={(v) =>
                                    handleChange("apellido_materno", v)
                                }
                            />
                            <Field
                                label="Teléfono Celular"
                                value={form.telefono_celular}
                                onChange={(v) =>
                                    handleChange("telefono_celular", v)
                                }
                            />
                            <Field
                                label="Correo Electrónico"
                                value={form.correo_electronico}
                                onChange={(v) =>
                                    handleChange("correo_electronico", v)
                                }
                                className="sm:col-span-2"
                            />
                            <Field
                                label="Estado Civil"
                                value={form.estado_civil}
                                onChange={(v) =>
                                    handleChange("estado_civil", v)
                                }
                            />
                            <Field
                                label="Grado de Estudios"
                                value={form.grado_estudios}
                                onChange={(v) =>
                                    handleChange("grado_estudios", v)
                                }
                            />
                            <Field
                                label="Fecha de Nacimiento"
                                value={form.fecha_nacimiento}
                                onChange={(v) =>
                                    handleChange("fecha_nacimiento", v)
                                }
                                type="date"
                            />
                            <Field
                                label="País de Nacimiento"
                                value={form.pais_nacimiento}
                                onChange={(v) =>
                                    handleChange("pais_nacimiento", v)
                                }
                            />
                            <Field
                                label="Estado de Nacimiento"
                                value={form.estado_nacimiento || ""}
                                onChange={(v) =>
                                    handleChange("estado_nacimiento", v)
                                }
                            />
                            <Field
                                label="Municipio de Nacimiento"
                                value={form.municipio_nacimiento || ""}
                                onChange={(v) =>
                                    handleChange("municipio_nacimiento", v)
                                }
                            />
                        </div>
                    )}

                    {activeTab === "domicilio" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Calle"
                                value={form.calle_domicilio}
                                onChange={(v) =>
                                    handleChange("calle_domicilio", v)
                                }
                                className="sm:col-span-2"
                            />
                            <Field
                                label="No. Exterior"
                                value={form.numero_exterior}
                                onChange={(v) =>
                                    handleChange("numero_exterior", v)
                                }
                            />
                            <Field
                                label="No. Interior"
                                value={form.numero_interior || ""}
                                onChange={(v) =>
                                    handleChange("numero_interior", v)
                                }
                            />
                            <Field
                                label="Colonia"
                                value={form.colonia_domicilio}
                                onChange={(v) =>
                                    handleChange("colonia_domicilio", v)
                                }
                            />
                            <Field
                                label="Código Postal"
                                value={form.codigo_postal}
                                onChange={(v) =>
                                    handleChange("codigo_postal", v)
                                }
                            />
                            <Field
                                label="País"
                                value={form.pais_domicilio}
                                onChange={(v) =>
                                    handleChange("pais_domicilio", v)
                                }
                            />
                            <Field
                                label="Estado"
                                value={form.estado_domicilio || ""}
                                onChange={(v) =>
                                    handleChange("estado_domicilio", v)
                                }
                            />
                            <Field
                                label="Municipio"
                                value={form.municipio_domicilio || ""}
                                onChange={(v) =>
                                    handleChange("municipio_domicilio", v)
                                }
                            />
                        </div>
                    )}

                    {activeTab === "familiar" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Nombre"
                                value={form.familiar_nombre}
                                onChange={(v) =>
                                    handleChange("familiar_nombre", v)
                                }
                            />
                            <Field
                                label="Parentesco"
                                value={form.familiar_parentesco}
                                onChange={(v) =>
                                    handleChange("familiar_parentesco", v)
                                }
                            />
                            <Field
                                label="Teléfono"
                                value={form.familiar_telefono}
                                onChange={(v) =>
                                    handleChange("familiar_telefono", v)
                                }
                            />
                            <Field
                                label="Calle"
                                value={form.familiar_calle || ""}
                                onChange={(v) =>
                                    handleChange("familiar_calle", v)
                                }
                            />
                            <Field
                                label="Número"
                                value={form.familiar_numero || ""}
                                onChange={(v) =>
                                    handleChange("familiar_numero", v)
                                }
                            />
                            <Field
                                label="Colonia"
                                value={form.familiar_colonia || ""}
                                onChange={(v) =>
                                    handleChange("familiar_colonia", v)
                                }
                            />
                            <Field
                                label="Código Postal"
                                value={form.familiar_codigo_postal || ""}
                                onChange={(v) =>
                                    handleChange("familiar_codigo_postal", v)
                                }
                            />
                            <Field
                                label="Estado"
                                value={form.familiar_estado || ""}
                                onChange={(v) =>
                                    handleChange("familiar_estado", v)
                                }
                            />
                            <Field
                                label="Municipio"
                                value={form.familiar_municipio || ""}
                                onChange={(v) =>
                                    handleChange("familiar_municipio", v)
                                }
                            />
                        </div>
                    )}

                    {activeTab === "emergencia" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label="Nombre"
                                value={form.emergencia_nombre}
                                onChange={(v) =>
                                    handleChange("emergencia_nombre", v)
                                }
                            />
                            <Field
                                label="Parentesco"
                                value={form.emergencia_parentesco}
                                onChange={(v) =>
                                    handleChange("emergencia_parentesco", v)
                                }
                            />
                            <Field
                                label="Teléfono"
                                value={form.emergencia_telefono}
                                onChange={(v) =>
                                    handleChange("emergencia_telefono", v)
                                }
                            />
                        </div>
                    )}

                    {activeTab === "curso" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-600 mb-1.5">
                                        Curso
                                    </label>
                                    <select
                                        value={form.curso}
                                        onChange={(e) =>
                                            handleChange(
                                                "curso",
                                                e.target.value,
                                            )
                                        }
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-50 transition-all"
                                    >
                                        <option value="COSMETOLOGIA">
                                            Diplomado en Cosmetología
                                        </option>
                                        <option value="COSMETOLOGIA ONLINE">
                                            Diplomado en Cosmetología Online
                                        </option>
                                        <option value="CEJAS PERFECTAS">
                                            Curso de Cejas Perfectas
                                        </option>
                                        <option value="MICROPIGMENTACION EN OJOS">
                                            Curso de Micropigmentación en Ojos
                                        </option>
                                        <option value="MICROPIGMENTACION EN LABIOS">
                                            Curso de Micropigmentación en Labios
                                        </option>
                                        <option value="MASAJES RELAJANTES">
                                            Curso de Masajes Relajantes
                                        </option>
                                        <option value="TRATAMIENTOS AVANZADOS">
                                            Taller de Tratamientos Avanzados
                                        </option>
                                        <option value="MICROPUNTURA">
                                            Taller de Micropuntura
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700">
                                    Documentos
                                </h3>
                                <FileUploadField
                                    label="INE / CURP"
                                    currentFile={form.ruta_ine}
                                    uploading={uploadingFile === "ruta_ine"}
                                    onUpload={(file) =>
                                        handleFileUpload("ruta_ine", file)
                                    }
                                />
                                <FileUploadField
                                    label="Acta de Nacimiento"
                                    currentFile={form.ruta_acta_nacimiento}
                                    uploading={
                                        uploadingFile === "ruta_acta_nacimiento"
                                    }
                                    onUpload={(file) =>
                                        handleFileUpload(
                                            "ruta_acta_nacimiento",
                                            file,
                                        )
                                    }
                                />
                                <FileUploadField
                                    label="Comprobante de Domicilio"
                                    currentFile={
                                        form.ruta_comprobante_domicilio
                                    }
                                    uploading={
                                        uploadingFile ===
                                        "ruta_comprobante_domicilio"
                                    }
                                    onUpload={(file) =>
                                        handleFileUpload(
                                            "ruta_comprobante_domicilio",
                                            file,
                                        )
                                    }
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-primary-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />{" "}
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" /> Guardar Cambios
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    type = "text",
    className = "",
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    className?: string;
}) {
    return (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-50 transition-all"
            />
        </div>
    );
}

function FileUploadField({
    label,
    currentFile,
    uploading,
    onUpload,
}: {
    label: string;
    currentFile: string | null;
    uploading: boolean;
    onUpload: (file: File) => void;
}) {
    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{label}</span>
                {currentFile && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                        Subido
                    </span>
                )}
            </div>
            <label
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${uploading ? "bg-gray-200 text-gray-400" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
            >
                {uploading ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin" /> Subiendo...
                    </>
                ) : (
                    <>
                        <Upload className="w-3 h-3" />{" "}
                        {currentFile ? "Reemplazar" : "Subir"}
                    </>
                )}
                <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                        if (e.target.files?.[0]) onUpload(e.target.files[0]);
                    }}
                    className="hidden"
                    disabled={uploading}
                />
            </label>
        </div>
    );
}
