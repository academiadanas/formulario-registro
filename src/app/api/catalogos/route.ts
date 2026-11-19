import { NextResponse } from 'next/server';
import { createPublicSupabaseClient } from '@/lib/supabase-public';
import { leerCatalogo } from '@/lib/catalogos';

// La lectura y la paginación viven en leerCatalogo: el prebuild
// (scripts/verificar-catalogo.mts) verifica esa misma función. Si esta ruta
// deja de usarla, el prebuild deja de cubrir lo que el formulario recibe.
export async function GET() {
  try {
    const catalogo = await leerCatalogo(createPublicSupabaseClient());
    return NextResponse.json(catalogo);
  } catch (error) {
    // Nunca se responde con un catálogo parcial: el formulario muestra un
    // aviso con reintento en lugar de un desplegable incompleto.
    console.error('[catalogos] No se pudo leer el catálogo completo:', error);
    return NextResponse.json(
      { error: 'No pudimos cargar la lista de estados y municipios.' },
      { status: 500 }
    );
  }
}
