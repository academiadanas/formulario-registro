'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { Registro } from '@/types';

const ITEMS_PER_PAGE = 15;

export default function AdminRegistrosPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [cursoFilter, setCursoFilter] = useState('');
  const [cursos, setCursos] = useState<string[]>([]);

  const loadRegistros = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('registros')
      .select('*', { count: 'exact' })
      .order('fecha_registro', { ascending: false })
      .range(from, to);

    if (searchTerm) {
      query = query.or(
        `nombre.ilike.%${searchTerm}%,apellido_paterno.ilike.%${searchTerm}%,apellido_materno.ilike.%${searchTerm}%,correo_electronico.ilike.%${searchTerm}%,telefono_celular.ilike.%${searchTerm}%`
      );
    }

    if (cursoFilter) {
      query = query.eq('curso', cursoFilter);
    }

    const { data, count, error } = await query;

    if (!error) {
      setRegistros(data as Registro[]);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [currentPage, searchTerm, cursoFilter]);

  // Cargar cursos disponibles
  useEffect(() => {
    async function loadCursos() {
      const supabase = createClient();
      const { data } = await supabase
        .from('registros')
        .select('curso')
        .order('curso');

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
  }, [searchTerm, cursoFilter]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Registros</h1>
        <span className="text-sm text-gray-500">
          {totalCount} registro{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, correo o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm
                hover:border-gray-300 focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <select
            value={cursoFilter}
            onChange={(e) => setCursoFilter(e.target.value)}
            className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm bg-white
              cursor-pointer hover:border-gray-300 focus:outline-none focus:border-primary transition-all"
          >
            <option value="">Todos los cursos</option>
            {cursos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
            <p className="text-lg mb-2">No se encontraron registros</p>
            <p className="text-sm">Intenta con otros filtros de búsqueda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-4">Folio</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-4">Nombre</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-4 hidden md:table-cell">Correo</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-4 hidden lg:table-cell">Teléfono</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-4 hidden sm:table-cell">Curso</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-4 hidden lg:table-cell">Fecha</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary-50 text-primary rounded-lg text-sm font-bold">
                        {r.id}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800 text-sm">
                        {r.nombre} {r.apellido_paterno} {r.apellido_materno}
                      </p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-gray-500">{r.correo_electronico}</p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-sm text-gray-500">{r.telefono_celular}</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                        {r.curso}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-sm text-gray-400">{formatDate(r.fecha_registro)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/registros/${r.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:text-primary-dark
                          text-sm font-medium transition-colors"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg
                hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg
                hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
