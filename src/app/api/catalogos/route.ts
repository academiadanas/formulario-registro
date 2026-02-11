import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CatalogosAgrupados } from '@/types';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('catalogos')
      .select('estado, municipio')
      .order('estado')
      .order('municipio');

    if (error) {
      console.error('Error fetching catalogos:', error);
      return NextResponse.json(
        { error: 'Error al obtener catálogos' },
        { status: 500 }
      );
    }

    // Agrupar por estado
    const agrupados: CatalogosAgrupados = {};
    for (const row of data) {
      if (!agrupados[row.estado]) {
        agrupados[row.estado] = [];
      }
      agrupados[row.estado].push(row.municipio);
    }

    return NextResponse.json(agrupados);
  } catch (error) {
    console.error('Error en API catalogos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
