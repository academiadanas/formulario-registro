'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

interface Stats {
  totalRegistros: number;
  registrosHoy: number;
  registrosSemana: number;
  cursos: { curso: string; total: number }[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient();

      // Total registros
      const { count: totalRegistros } = await supabase
        .from('registros')
        .select('*', { count: 'exact', head: true });

      // Registros hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: registrosHoy } = await supabase
        .from('registros')
        .select('*', { count: 'exact', head: true })
        .gte('fecha_registro', today.toISOString());

      // Registros última semana
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: registrosSemana } = await supabase
        .from('registros')
        .select('*', { count: 'exact', head: true })
        .gte('fecha_registro', weekAgo.toISOString());

      // Registros por curso
      const { data: registros } = await supabase
        .from('registros')
        .select('curso');

      const cursosMap: Record<string, number> = {};
      registros?.forEach((r) => {
        cursosMap[r.curso] = (cursosMap[r.curso] || 0) + 1;
      });
      const cursos = Object.entries(cursosMap)
        .map(([curso, total]) => ({ curso, total }))
        .sort((a, b) => b.total - a.total);

      setStats({
        totalRegistros: totalRegistros || 0,
        registrosHoy: registrosHoy || 0,
        registrosSemana: registrosSemana || 0,
        cursos,
      });
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-8">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">Total Registros</p>
          <p className="text-3xl font-bold text-gray-800">{stats?.totalRegistros}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">Registros Hoy</p>
          <p className="text-3xl font-bold text-primary">{stats?.registrosHoy}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">Última Semana</p>
          <p className="text-3xl font-bold text-blue-600">{stats?.registrosSemana}</p>
        </div>
      </div>

      {/* Registros por curso */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-5">Registros por Curso</h2>
        <div className="space-y-3">
          {stats?.cursos.map((c) => (
            <div key={c.curso} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{c.curso}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-primary to-primary-dark h-2.5 rounded-full transition-all"
                    style={{ width: `${(c.total / (stats?.totalRegistros || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-8 text-right">{c.total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick action */}
      <Link
        href="/admin/registros"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark
          text-white py-3 px-6 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
      >
        📋 Ver Todos los Registros
      </Link>
    </div>
  );
}
