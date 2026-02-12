"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Registro } from "@/types";
import {
    Search,
    Filter,
    FileText,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ITEMS_PER_PAGE = 15;

export default function AdminRegistrosPage() {
    const [registros, setRegistros] = useState<Registro[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [cursoFilter, setCursoFilter] = useState("");
    const [docsFilter, setDocsFilter] = useState("");
    const [cursos, setCursos] = useState<string[]>([]);

    const loadRegistros = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
            .from("registros")
            .select("*", { count: "exact" })
            .order("fecha_registro", { ascending: false })
            .range(from, to);

        if (searchTerm) {
            query = query.or(
                `nombre.ilike.%${searchTerm}%,apellido_paterno.ilike.%${searchTerm}%,apellido_materno.ilike.%${searchTerm}%,correo_electronico.ilike.%${searchTerm}%,telefono_celular.ilike.%${searchTerm}%`,
            );
        }

        if (cursoFilter) {
            query = query.eq("curso", cursoFilter);
        }

        if (docsFilter === "completos") {
            query = query
                .not("ruta_ine", "is", null)
                .not("ruta_acta_nacimiento", "is", null)
                .not("ruta_comprobante_domicilio", "is", null);
        } else if (docsFilter === "pendientes") {
            query = query.or(
                "ruta_ine.is.null,ruta_acta_nacimiento.is.null,ruta_comprobante_domicilio.is.null",
            );
        }

        const { data, count, error } = await query;

        if (!error) {
            setRegistros(data as Registro[]);
            setTotalCount(count || 0);
        }
        setLoading(false);
    }, [currentPage, searchTerm, cursoFilter, docsFilter]);

    // Cargar cursos disponibles
    useEffect(() => {
        async function loadCursos() {
            const supabase = createClient();
            const { data } = await supabase
                .from("registros")
                .select("curso")
                .order("curso");

            if (data) {
                const uniqueCursos = [...new Set(data.map((r) => r.curso))];
                setCursos(uniqueCursos);
            }
        }
        loadCursos();
    }, []);

    useEffect(() => {
        loadRegistros();
    }, [loadRegistros]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, cursoFilter, docsFilter]);

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    async function handleExportFiltered() {
        const supabase = createClient();

        let query = supabase
            .from("registros")
            .select("*")
            .order("fecha_registro", { ascending: false });

        if (searchTerm) {
            query = query.or(
                `nombre.ilike.%${searchTerm}%,apellido_paterno.ilike.%${searchTerm}%,apellido_materno.ilike.%${searchTerm}%,correo_electronico.ilike.%${searchTerm}%,telefono_celular.ilike.%${searchTerm}%`,
            );
        }
        if (cursoFilter) {
            query = query.eq("curso", cursoFilter);
        }
        if (docsFilter === "completos") {
            query = query
                .not("ruta_ine", "is", null)
                .not("ruta_acta_nacimiento", "is", null)
                .not("ruta_comprobante_domicilio", "is", null);
        } else if (docsFilter === "pendientes") {
            query = query.or(
                "ruta_ine.is.null,ruta_acta_nacimiento.is.null,ruta_comprobante_domicilio.is.null",
            );
        }

        const { data } = await query;
        if (!data || data.length === 0) return;

        const exportData = data.map((r) => ({
            Folio: r.id,
            Nombre: `${r.nombre} ${r.apellido_paterno} ${r.apellido_materno}`,
            Correo: r.correo_electronico,
            Teléfono: r.telefono_celular,
            Curso: r.curso,
            "Fecha Registro": new Date(r.fecha_registro).toLocaleDateString(
                "es-MX",
            ),
            INE: r.ruta_ine ? "Sí" : "No",
            "Acta Nacimiento": r.ruta_acta_nacimiento ? "Sí" : "No",
            "Comp. Domicilio": r.ruta_comprobante_domicilio ? "Sí" : "No",
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros");
        ws["!cols"] = Object.keys(exportData[0]).map((key) => ({
            wch: Math.max(key.length, 15),
        }));

        const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const fecha = new Date().toISOString().split("T")[0];
        saveAs(blob, `registros_filtrados_${fecha}.xlsx`);
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

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        Registros
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {totalCount} registro{totalCount !== 1 ? "s" : ""}{" "}
                        encontrado{totalCount !== 1 ? "s" : ""}
                    </p>
                </div>
                <button
                    onClick={handleExportFiltered}
                    className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700
            py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300
            transition-all shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Exportar Filtrados
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, correo o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                hover:border-gray-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-50 transition-all"
                        />
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select
                                value={cursoFilter}
                                onChange={(e) => setCursoFilter(e.target.value)}
                                className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
                  cursor-pointer hover:border-gray-300 focus:outline-none focus:border-primary transition-all appearance-none"
                            >
                                <option value="">Todos los cursos</option>
                                {cursos.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <select
                            value={docsFilter}
                            onChange={(e) => setDocsFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
                cursor-pointer hover:border-gray-300 focus:outline-none focus:border-primary transition-all"
                        >
                            <option value="">Todos los docs</option>
                            <option value="completos">Docs completos</option>
                            <option value="pendientes">Docs pendientes</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
                    </div>
                ) : registros.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg mb-1 font-medium">
                            No se encontraron registros
                        </p>
                        <p className="text-sm">
                            Intenta con otros filtros de búsqueda
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                        Folio
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                                        Nombre
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden md:table-cell">
                                        Correo
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden lg:table-cell">
                                        Teléfono
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">
                                        Curso
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden lg:table-cell">
                                        Fecha
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3 hidden md:table-cell">
                                        Docs
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {registros.map((r) => {
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
                                                    {r.nombre}{" "}
                                                    {r.apellido_paterno}{" "}
                                                    {r.apellido_materno}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5 hidden md:table-cell">
                                                <p className="text-sm text-gray-500">
                                                    {r.correo_electronico}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5 hidden lg:table-cell">
                                                <p className="text-sm text-gray-500">
                                                    {r.telefono_celular}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5 hidden sm:table-cell">
                                                <span className="inline-block text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                                                    {r.curso}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 hidden lg:table-cell">
                                                <p className="text-xs text-gray-400">
                                                    {formatDate(
                                                        r.fecha_registro,
                                                    )}
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
                                                    className="inline-flex items-center gap-1.5 text-primary hover:text-primary-dark
                            text-xs font-semibold transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Ver
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                        <button
                            onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg
                hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Anterior
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from(
                                { length: Math.min(totalPages, 5) },
                                (_, i) => {
                                    let page: number;
                                    if (totalPages <= 5) {
                                        page = i + 1;
                                    } else if (currentPage <= 3) {
                                        page = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        page = totalPages - 4 + i;
                                    } else {
                                        page = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
                      ${
                          currentPage === page
                              ? "bg-primary text-white shadow-md shadow-primary/20"
                              : "text-gray-500 hover:bg-gray-100"
                      }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                },
                            )}
                        </div>
                        <button
                            onClick={() =>
                                setCurrentPage((p) =>
                                    Math.min(totalPages, p + 1),
                                )
                            }
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg
                hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Siguiente
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
