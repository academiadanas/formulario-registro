/**
 * Utilidades compartidas por los scripts que leen el bucket `documentos` y
 * las columnas ruta_* de `registros` (verificación del invariante y
 * promoción de temp/ a registros/).
 *
 * Solo lectura: aquí no hay ninguna función que escriba, mueva o borre.
 *
 * Credenciales: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, leídas
 * del entorno. La llave nunca se imprime; `mensaje()` la redacta de cualquier
 * error.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'documentos';

// Proyecto Supabase anterior (ya no resuelve DNS). Algunas columnas pudieron
// guardar URLs con ese host; el objeto vive en el proyecto actual con la
// misma ruta.
export const HOSTS_ANTERIORES = ['https://uafyxhczxbsyzfyjokwf.supabase.co'];

export const COLUMNAS = [
  'ruta_ine_frente',
  'ruta_ine_reverso',
  'ruta_acta_nacimiento',
  'ruta_comprobante_domicilio',
] as const;
export type Columna = (typeof COLUMNAS)[number];

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INTENTOS = 3;
const PAGINA = 1000;

export function supabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
}

/** Quita la llave de cualquier texto antes de imprimirlo o guardarlo. */
export function limpiar(texto: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return key ? texto.split(key).join('[REDACTADO]') : texto;
}

export function mensaje(e: unknown): string {
  if (e instanceof Error) return limpiar(e.message);
  if (e && typeof e === 'object' && 'message' in e) return limpiar(String((e as { message: unknown }).message));
  return limpiar(String(e));
}

/** Cliente con service role y tiempo límite por petición. */
export function cliente(timeoutMs = 60_000): SupabaseClient {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno (usar node --env-file=.env.local).',
    );
  }
  const fetchConTimeout: typeof fetch = (input, init) => {
    const t = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, t]) : t;
    return fetch(input, { ...init, signal });
  };
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchConTimeout },
  });
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function conReintentos<T>(descripcion: string, fn: () => Promise<T>): Promise<T> {
  let ultimo: unknown;
  for (let i = 1; i <= INTENTOS; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (i < INTENTOS) await esperar(1000 * i);
    }
  }
  throw new Error(`${descripcion}: falló tras ${INTENTOS} intentos: ${mensaje(ultimo)}`);
}

export interface ObjetoBucket {
  ruta: string;
  tamano: number | null;
  mimetype: string | null;
  etag: string | null;
  creado: string | null;
}

/**
 * Lista TODO el bucket, página por página. Aborta (lanza) si una página no se
 * puede leer tras reintentos o si el listado sale inconsistente: nunca
 * devuelve un listado incompleto en silencio.
 */
export async function listarBucket(
  sb: SupabaseClient,
): Promise<{ objetos: ObjetoBucket[]; carpetas: Set<string> }> {
  const objetos: ObjetoBucket[] = [];
  const carpetas = new Set<string>();
  const vistas = new Set<string>();
  const pendientes: string[] = [''];

  while (pendientes.length > 0) {
    const carpeta = pendientes.shift() as string;
    for (let offset = 0; ; offset += PAGINA) {
      const pagina = await conReintentos(`Listar "${carpeta || '/'}" desde ${offset}`, async () => {
        const { data, error } = await sb.storage
          .from(BUCKET)
          .list(carpeta, { limit: PAGINA, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('respuesta sin lista');
        return data;
      });
      for (const item of pagina) {
        const ruta = carpeta ? `${carpeta}/${item.name}` : item.name;
        if ((item.id as string | null) === null) {
          if (carpetas.has(ruta)) throw new Error(`Listado inconsistente: carpeta repetida "${ruta}"`);
          carpetas.add(ruta);
          pendientes.push(ruta);
        } else {
          if (vistas.has(ruta)) throw new Error(`Listado inconsistente: objeto repetido "${ruta}"`);
          vistas.add(ruta);
          const meta = (item.metadata ?? {}) as { size?: number; mimetype?: string; eTag?: string };
          objetos.push({
            ruta,
            tamano: typeof meta.size === 'number' ? meta.size : null,
            mimetype: meta.mimetype ?? null,
            etag: meta.eTag ?? null,
            creado: item.created_at ?? null,
          });
        }
      }
      if (pagina.length < PAGINA) break;
    }
  }
  return { objetos, carpetas };
}

/** SELECT paginado de `registros` con los campos indicados. Solo lectura. */
export async function leerRegistros<T>(sb: SupabaseClient, campos: readonly string[]): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const lote = await conReintentos(`Leer registros desde ${desde}`, async () => {
      const { data, error } = await sb
        .from('registros')
        .select(campos.join(','))
        .order('id', { ascending: true })
        .range(desde, desde + PAGINA - 1);
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    });
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return filas;
}

export type RutaInterpretada =
  | { ruta: string; forma: 'relativa' | 'url' }
  | { fuera: string };

/**
 * Convierte el valor de una columna ruta_* a la ruta del objeto en el bucket.
 * Acepta ruta relativa o URL pública completa (host actual o anterior).
 * Cualquier otra URL (Drive, otro bucket) se devuelve como `fuera`.
 */
export function aRuta(valor: string): RutaInterpretada {
  const v = valor.trim();
  if (/^https?:\/\//i.test(v)) {
    const marca = [supabaseUrl(), ...HOSTS_ANTERIORES]
      .map((h) => `${h}/storage/v1/object/public/${BUCKET}/`)
      .find((m) => v.startsWith(m));
    if (!marca) {
      const host = (() => {
        try {
          return new URL(v).host;
        } catch {
          return 'URL inválida';
        }
      })();
      return { fuera: host };
    }
    let resto = v.slice(marca.length).split(/[?#]/)[0];
    try {
      resto = decodeURIComponent(resto);
    } catch {
      return { fuera: 'URL con codificación inválida' };
    }
    return { ruta: resto, forma: 'url' };
  }
  return { ruta: v.replace(/^\/+/, ''), forma: 'relativa' };
}
