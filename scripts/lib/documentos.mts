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
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

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

// ------------------------------------------------- archivos locales

/** sha256 en hex del contenido de un archivo local. */
export function sha256Archivo(ruta: string): string {
  return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

/** CSV mínimo RFC 4180: campos entre comillas, "" como comilla, CRLF o LF. */
export function parsearCsv(texto: string): string[][] {
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (enComillas) throw new Error('CSV mal formado: comillas sin cerrar');
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

export interface EntradaManifiesto {
  sha256: string;
  tamano: number | null;
  mimetype: string;
  estado: string;
}

/**
 * Lee el manifiesto.csv de scripts/respaldo-documentos.mts y lo indexa por
 * ruta en Storage. Aborta si faltan columnas o hay rutas repetidas.
 */
export function leerManifiesto(ruta: string): Map<string, EntradaManifiesto> {
  const filas = parsearCsv(readFileSync(ruta, 'utf8'));
  const [enc, ...datos] = filas;
  const col = (n: string) => {
    const i = enc?.indexOf(n) ?? -1;
    if (i === -1) throw new Error(`El manifiesto no tiene la columna "${n}"`);
    return i;
  };
  const iRuta = col('ruta_storage');
  const iSha = col('sha256');
  const iTam = col('tamano_descargado');
  const iMime = col('mimetype');
  const iEstado = col('estado');
  const m = new Map<string, EntradaManifiesto>();
  for (const f of datos) {
    if (f.length === 1 && f[0] === '') continue;
    const r = f[iRuta];
    if (m.has(r)) throw new Error(`Manifiesto con ruta repetida: ${r}`);
    m.set(r, {
      sha256: f[iSha],
      tamano: f[iTam] === '' ? null : Number(f[iTam]),
      mimetype: f[iMime],
      estado: f[iEstado],
    });
  }
  return m;
}

// Archivos con rutas nuevas, planes o bitácoras: nunca dentro de un repo git
// ni de una carpeta sincronizada por OneDrive. Mismo criterio que
// scripts/respaldo-documentos.mts.

function existenteMasCercano(p: string): string {
  let d = p;
  while (!existsSync(d)) {
    const padre = dirname(d);
    if (padre === d) break;
    d = padre;
  }
  return d;
}

function buscarGit(desde: string): string | null {
  let d = desde;
  while (true) {
    if (existsSync(join(d, '.git'))) return d;
    const padre = dirname(d);
    if (padre === d) return null;
    d = padre;
  }
}

function carpetasOneDrive(): string[] {
  const raices = new Set<string>();
  for (const k of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
    const v = process.env[k];
    if (v) raices.add(v);
  }
  if (process.platform === 'win32') {
    const ps = [
      '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
      '$r = @()',
      "Get-ChildItem 'HKCU:\Software\Microsoft\OneDrive\Accounts' -ErrorAction SilentlyContinue | ForEach-Object {",
      '  $uf = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).UserFolder',
      '  if ($uf) { $r += $uf }',
      "  $m = Join-Path $_.PSPath 'ScopeIdToMountPointPathCache'",
      '  if (Test-Path $m) { $k = Get-Item $m; $k.GetValueNames() | ForEach-Object { $r += [string]$k.GetValue($_) } }',
      "  $t = Join-Path $_.PSPath 'Tenants'",
      "  if (Test-Path $t) { Get-ChildItem $t | ForEach-Object { $_.GetValueNames() | Where-Object { $_ -match '^[A-Za-z]:\\' } | ForEach-Object { $r += $_ } } }",
      '}',
      'ConvertTo-Json -InputObject @($r) -Compress',
    ].join('\n');
    let salida: string;
    try {
      salida = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      });
    } catch (e) {
      throw new Error(`No se pudo leer del registro qué carpetas sincroniza OneDrive: ${mensaje(e)}`);
    }
    const lista: unknown = JSON.parse(salida.trim() || '[]');
    if (!Array.isArray(lista)) throw new Error('Lista de carpetas de OneDrive con formato inesperado.');
    for (const v of lista) if (typeof v === 'string' && v.trim()) raices.add(v.trim());
  }
  return [...raices].map((r) => resolve(r));
}

/** Aborta si `ruta` (o un padre) está en un repo git o en OneDrive. */
export function verificarUbicacionSegura(ruta: string): void {
  const abs = resolve(ruta);
  const base = existenteMasCercano(abs);
  const candidatos = new Set([abs, base, realpathSync.native(base)]);
  for (const c of candidatos) {
    const repo = buscarGit(c);
    if (repo) {
      throw new Error(`${abs} está dentro de un repositorio git (${repo}). Contiene rutas que protegen documentos: guárdalo fuera de cualquier repo.`);
    }
  }
  const raices = carpetasOneDrive();
  const reales = new Set(raices);
  for (const r of raices) if (existsSync(r)) reales.add(realpathSync.native(r));
  for (const c of candidatos) {
    const lc = c.toLowerCase();
    const raiz = [...reales].find((r) => {
      const b = r.toLowerCase().replace(/[\/]+$/, '');
      return lc === b || lc.startsWith(b + sep);
    });
    const porNombre = c.split(/[\/]/).find((s) => /^onedrive( - .+)?$/i.test(s));
    if (raiz || porNombre) {
      throw new Error(`${abs} está dentro de una carpeta sincronizada por OneDrive (${raiz ?? porNombre}). Guárdalo en una carpeta local no sincronizada.`);
    }
  }
}
