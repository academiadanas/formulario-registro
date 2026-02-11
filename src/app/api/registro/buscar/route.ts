import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { correo, telefono } = await request.json();

    if (!correo || !telefono) {
      return NextResponse.json(
        { error: 'Correo y teléfono son obligatorios' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('buscar_registro', {
      p_correo: correo,
      p_telefono: telefono,
    });

    if (error) {
      console.error('Error buscando registro:', error);
      return NextResponse.json(
        { error: 'Error al buscar el registro' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { found: false, message: 'No se encontró ningún registro con esos datos.' }
      );
    }

    const registro = data[0];

    return NextResponse.json({
      found: true,
      id: registro.registro_id,
      nombre: registro.nombre_completo,
      curso: registro.curso,
      fecha: registro.fecha_registro,
    });
  } catch (error) {
    console.error('Error en API buscar:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
