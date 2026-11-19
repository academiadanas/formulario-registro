import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogosAgrupados } from '@/types';

// Lectura completa de la tabla `catalogos` (estados y municipios de México).
//
// Supabase corta cada respuesta en su límite "Max rows" (1000 en este
// proyecto, compartido con las otras apps del ecosistema). Sin paginar, el
// formulario recibía solo las primeras 1000 filas: 19 de 32 estados, y
// Nuevo León sin Monterrey. Por eso se lee por páginas.
//
// La paginación avanza por las filas que de verdad llegaron y se detiene al
// alcanzar el total que reporta Supabase, no al recibir "menos de las
// pedidas": si el límite del servidor fuera menor que la página, esa
// condición tomaría la primera página corta por la última y devolvería un
// catálogo incompleto en silencio.
//
// Lanza si una página falla o si las filas no suman el total. Nunca devuelve
// un catálogo parcial.
//
// La usan /api/catalogos y scripts/verificar-catalogo.mts (prebuild). Solo
// importa tipos para que Node pueda cargarla desde el script; no agregar
// imports de valores con alias "@/".

const FILAS_POR_PAGINA = 1000;

type FilaCatalogo = { estado: string; municipio: string };

export async function leerCatalogo(
  supabase: SupabaseClient,
): Promise<CatalogosAgrupados> {
  const filas: FilaCatalogo[] = [];
  let total = 0;

  do {
    const desde = filas.length;
    const { data, error, count } = await supabase
      .from('catalogos')
      .select('estado, municipio', desde === 0 ? { count: 'exact' } : undefined)
      .order('estado')
      .order('municipio')
      // Desempate por la llave primaria: el orden debe ser total para que
      // ninguna fila se repita ni se salte entre páginas.
      .order('id')
      .range(desde, desde + FILAS_POR_PAGINA - 1);

    if (error) {
      throw new Error(
        `catalogos: falló la página que empieza en la fila ${desde}: ${error.message}`,
      );
    }
    if (desde === 0) {
      if (count === null) {
        throw new Error('catalogos: Supabase no devolvió el total de filas');
      }
      total = count;
    }
    if (data.length === 0 && filas.length < total) {
      throw new Error(
        `catalogos: página vacía en la fila ${desde} de ${total}; la tabla cambió durante la lectura`,
      );
    }
    filas.push(...(data as FilaCatalogo[]));
  } while (filas.length < total);

  if (filas.length !== total) {
    throw new Error(
      `catalogos: se leyeron ${filas.length} filas y Supabase reporta ${total}`,
    );
  }

  const agrupados: CatalogosAgrupados = {};
  for (const fila of filas) {
    if (!agrupados[fila.estado]) {
      agrupados[fila.estado] = [];
    }
    agrupados[fila.estado].push(fila.municipio);
  }
  return agrupados;
}
