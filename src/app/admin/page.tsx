"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Registro } from "@/types";
import {
    Users,
    UserPlus,
    CalendarDays,
    TrendingUp,
    FileText,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
    Download,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useUserRole } from "@/hooks/useUserRole";

interface Stats {
    totalRegistros: number;
    registrosHoy: number;
    registrosSemana: number;
    registrosMes: number;
    docsCompletos: number;
    docsPendientes: number;
    cursos: { name: string; value: number }[];
    registrosPorMes: { mes: string; registros: number }[];
    ultimosRegistros: Registro[];
}

const COLORS = [
    "#e74a82",
    "#f07da6",
    "#d22c64",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
];

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const userRole = useUserRole();

    useEffect(() => {
        async function loadStats() {
            const supabase = createClient();

            // Traer todos los registros para calcular estadísticas
            const { data: registros, count: totalRegistros } = await supabase
                .from("registros")
                .select("*", { count: "exact" })
                .order("fecha_registro", { ascending: false });

            if (!registros) {
                setLoading(false);
                return;
            }

            const now = new Date();

            // Registros hoy
            const todayStart = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
            );
            const registrosHoy = registros.filter(
                (r) => new Date(r.fecha_registro) >= todayStart,
            ).length;

            // Registros última semana
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const registrosSemana = registros.filter(
                (r) => new Date(r.fecha_registro) >= weekAgo,
            ).length;

            // Registros último mes
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            const registrosMes = registros.filter(
                (r) => new Date(r.fecha_registro) >= monthAgo,
            ).length;

            // Documentos completos vs pendientes
            const docsCompletos = registros.filter(
                (r) =>
                    r.ruta_ine &&
                    r.ruta_acta_nacimiento &&
                    r.ruta_comprobante_domicilio,
            ).length;
            const docsPendientes = (totalRegistros || 0) - docsCompletos;

            // Registros por curso (para PieChart)
            const cursosMap: Record<string, number> = {};
            registros.forEach((r) => {
                cursosMap[r.curso] = (cursosMap[r.curso] || 0) + 1;
            });
            const cursos = Object.entries(cursosMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            // Registros por mes (últimos 6 meses para BarChart)
            const registrosPorMes: { mes: string; registros: number }[] = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const mesKey = d.toLocaleDateString("es-MX", {
                    month: "short",
                    year: "2-digit",
                });
                const nextMonth = new Date(
                    d.getFullYear(),
                    d.getMonth() + 1,
                    1,
                );
                const count = registros.filter((r) => {
                    const fecha = new Date(r.fecha_registro);
                    return fecha >= d && fecha < nextMonth;
                }).length;
                registrosPorMes.push({ mes: mesKey, registros: count });
            }

            // Últimos 5 registros
            const ultimosRegistros = registros.slice(0, 5) as Registro[];

            setStats({
                totalRegistros: totalRegistros || 0,
                registrosHoy,
                registrosSemana,
                registrosMes,
                docsCompletos,
                docsPendientes,
                cursos,
                registrosPorMes,
                ultimosRegistros,
            });
            setLoading(false);
        }
        loadStats();
    }, []);

    async function handleExportExcel() {
        const supabase = createClient();
        const { data } = await supabase
            .from("registros")
            .select("*")
            .order("fecha_registro", { ascending: false });

        if (!data || data.length === 0) return;

        const exportData = data.map((r) => ({
            Folio: r.id,
            Nombre: r.nombre,
            "Apellido Paterno": r.apellido_paterno,
            "Apellido Materno": r.apellido_materno,
            Correo: r.correo_electronico,
            Teléfono: r.telefono_celular,
            Curso: r.curso,
            "Estado Civil": r.estado_civil,
            "Grado de Estudios": r.grado_estudios,
            "Fecha de Nacimiento": r.fecha_nacimiento,
            "País Nacimiento": r.pais_nacimiento,
            "Estado Nacimiento": r.estado_nacimiento,
            "Municipio Nacimiento": r.municipio_nacimiento,
            Calle: r.calle_domicilio,
            "No. Exterior": r.numero_exterior,
            "No. Interior": r.numero_interior,
            Colonia: r.colonia_domicilio,
            CP: r.codigo_postal,
            "Estado Domicilio": r.estado_domicilio,
            "Municipio Domicilio": r.municipio_domicilio,
            "Familiar Nombre": r.familiar_nombre,
            "Familiar Parentesco": r.familiar_parentesco,
            "Familiar Teléfono": r.familiar_telefono,
            "Emergencia Nombre": r.emergencia_nombre,
            "Emergencia Parentesco": r.emergencia_parentesco,
            "Emergencia Teléfono": r.emergencia_telefono,
            INE: r.ruta_ine ? "Sí" : "No",
            "Acta Nacimiento": r.ruta_acta_nacimiento ? "Sí" : "No",
            "Comprobante Domicilio": r.ruta_comprobante_domicilio ? "Sí" : "No",
            "Fecha Registro": new Date(r.fecha_registro).toLocaleDateString(
                "es-MX",
            ),
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros");

        // Ajustar ancho de columnas
        const colWidths = Object.keys(exportData[0]).map((key) => ({
            wch: Math.max(key.length, 15),
        }));
        ws["!cols"] = colWidths;

        const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const fecha = new Date().toISOString().split("T")[0];
        saveAs(blob, `registros_academia_danas_${fecha}.xlsx`);
    }

    function formatDate(dateStr: string) {
        try {
            return new Date(dateStr).toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
                year: "numeric",
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
                        Cargando estadísticas...
                    </p>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        Dashboard
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Resumen general de inscripciones
                    </p>
                </div>
                {userRole.canExport && (
                    <button
                        onClick={handleExportExcel}
                        className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700
                py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300
                transition-all shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Excel
                    </button>
                )}
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                    icon={Users}
                    label="Total Registros"
                    value={stats.totalRegistros}
                    color="primary"
                />
                <StatsCard
                    icon={UserPlus}
                    label="Hoy"
                    value={stats.registrosHoy}
                    color="green"
                />
                <StatsCard
                    icon={CalendarDays}
                    label="Esta Semana"
                    value={stats.registrosSemana}
                    color="blue"
                />
                <StatsCard
                    icon={TrendingUp}
                    label="Este Mes"
                    value={stats.registrosMes}
                    color="purple"
                />
            </div>

            {/* Documentos indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
                    <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">
                            Documentos Completos
                        </p>
                        <p className="text-xl font-bold text-gray-800">
                            {stats.docsCompletos}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                            {stats.totalRegistros > 0
                                ? Math.round(
                                      (stats.docsCompletos /
                                          stats.totalRegistros) *
                                          100,
                                  )
                                : 0}
                            %
                        </span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">
                            Documentos Pendientes
                        </p>
                        <p className="text-xl font-bold text-gray-800">
                            {stats.docsPendientes}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                            {stats.totalRegistros > 0
                                ? Math.round(
                                      (stats.docsPendientes /
                                          stats.totalRegistros) *
                                          100,
                                  )
                                : 0}
                            %
                        </span>
                    </div>
                </div>
            </div>

            {/* Gráficas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Registros por mes */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">
                        Registros por Mes
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.registrosPorMes} barSize={32}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#f0f0f0"
                                />
                                <XAxis
                                    dataKey="mes"
                                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: "12px",
                                        border: "1px solid #e5e7eb",
                                        boxShadow:
                                            "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                        fontSize: "13px",
                                    }}
                                />
                                <Bar
                                    dataKey="registros"
                                    fill="#e74a82"
                                    radius={[6, 6, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribución por curso */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">
                        Distribución por Curso
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.cursos}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={85}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {stats.cursos.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: "12px",
                                        border: "1px solid #e5e7eb",
                                        boxShadow:
                                            "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                        fontSize: "13px",
                                    }}
                                />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: "11px" }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Últimos registros */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-700">
                        Últimos Registros
                    </h2>
                    <Link
                        href="/admin/registros"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
                    >
                        Ver todos <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/80">
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                    Folio
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                    Nombre
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">
                                    Curso
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden md:table-cell">
                                    Fecha
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden md:table-cell">
                                    Docs
                                </th>
                                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.ultimosRegistros.map((r) => {
                                const docsCount = [
                                    r.ruta_ine,
                                    r.ruta_acta_nacimiento,
                                    r.ruta_comprobante_domicilio,
                                ].filter(Boolean).length;
                                return (
                                    <tr
                                        key={r.id}
                                        className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
                                    >
                                        <td className="px-5 py-3.5">
                                            <span className="inline-flex items-center justify-center w-8 h-8 bg-primary-50 text-primary rounded-lg text-xs font-bold">
                                                {r.id}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="font-medium text-gray-800 text-sm">
                                                {r.nombre} {r.apellido_paterno}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {r.correo_electronico}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3.5 hidden sm:table-cell">
                                            <span className="inline-block text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                                                {r.curso}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 hidden md:table-cell">
                                            <p className="text-xs text-gray-400">
                                                {formatDate(r.fecha_registro)}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3.5 hidden md:table-cell">
                                            <span
                                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full
                        ${
                            docsCount === 3
                                ? "bg-green-50 text-green-600"
                                : docsCount > 0
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-gray-100 text-gray-400"
                        }`}
                                            >
                                                <FileText className="w-3 h-3" />
                                                {docsCount}/3
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <Link
                                                href={`/admin/registros/${r.id}`}
                                                className="text-primary hover:text-primary-dark text-xs font-semibold transition-colors"
                                            >
                                                Ver →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Componente de tarjeta de estadísticas
function StatsCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color: "primary" | "green" | "blue" | "purple";
}) {
    const colorClasses = {
        primary: {
            bg: "bg-primary-50",
            icon: "text-primary",
            text: "text-primary",
        },
        green: {
            bg: "bg-green-50",
            icon: "text-green-500",
            text: "text-green-600",
        },
        blue: {
            bg: "bg-blue-50",
            icon: "text-blue-500",
            text: "text-blue-600",
        },
        purple: {
            bg: "bg-purple-50",
            icon: "text-purple-500",
            text: "text-purple-600",
        },
    };

    const c = colorClasses[color];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div
                    className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}
                >
                    <Icon className={`w-[18px] h-[18px] ${c.icon}`} />
                </div>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
        </div>
    );
}
