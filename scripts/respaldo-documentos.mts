/**
 * RESPALDO COMPLETO DEL BUCKET `documentos` — SOLO LECTURA
 *
 * Por qué existe: los respaldos de base de datos de Supabase (diarios, PITR o
 * pg_dump) NO incluyen los archivos de Storage, solo sus metadatos en
 * storage.objects. Las INE, actas y comprobantes viven en un solo lugar. Este
 * script hace una copia local completa antes de cualquier migración que
 * copie o borre objetos.
 *
 * Qué hace:
 *  1. Lista TODO el bucket (temp/, registros/ y cualquier otro prefijo),
 *     página por página. Si una página no se puede leer tras reintentos,
 *     aborta: nunca termina con una copia incompleta en silencio.
 *  2. Lee `registros` (solo SELECT) para saber de quién es cada objeto:
 *     por upload_session_id (carpetas temp/{uuid}/) y por las columnas
 *     ruta_* (rutas relativas o URLs públicas completas).
 *  3. Descarga cada objeto a <destino>/documentos/<ruta en Storage>.
 *  4. Escribe junto a los archivos:
 *       manifiesto.csv     una fila por objeto (tamaños, sha256, dueño)
 *       sha256sums.txt     para verificar la copia después (sha256sum -c)
 *       verificacion.json  listas completas de fallos, referencias rotas,
 *                          objetos sin ruta_* y huérfanos
 *  5. Imprime la verificación final. Sale con código 1 si algún objeto no
 *     se pudo bajar o llegó con tamaño distinto, y 2 si abortó.
 *
 * Qué NO hace: no borra, no mueve, no sube ni escribe nada en Storage ni en
 * la base. Las únicas llamadas a Supabase son list, download y select.
 *
 * Protecciones del destino:
 *  - --destino es obligatorio; no hay ruta por defecto.
 *  - Se rehúsa si el destino (o cualquier directorio padre) contiene .git:
 *    son identificaciones oficiales y no deben acabar en un repositorio.
 *  - Se rehúsa si el destino cae dentro de una carpeta sincronizada por
 *    OneDrive (variables de entorno y registro de Windows, más cualquier
 *    carpeta llamada "OneDrive..."): no deben acabar en una nube personal.
 *    Ambos rechazos ocurren antes de crear nada.
 *  - El destino debe no existir o estar vacío, para no mezclar copias.
 *  - Mientras corre existe <destino>/EN_PROCESO.txt. Si el script se
 *    interrumpe, ese archivo se queda: la copia está incompleta, se borra
 *    la carpeta y se vuelve a correr. Si termina con fallos, se renombra a
 *    COPIA_CON_FALLOS.txt. Si termina bien, se elimina.
 *
 * Credenciales: se leen de NEXT_PUBLIC_SUPABASE_URL y
 * SUPABASE_SERVICE_ROLE_KEY. La llave nunca se imprime ni se escribe en el
 * manifiesto; los mensajes de error se limpian por si la contuvieran. La URL
 * del proyecto sí se imprime al inicio y queda en verificacion.json: si la
 * variable ya existía en la terminal, Node usa ésa y no la de --env-file.
 *
 * Uso (desde la raíz del repo, Node >= 22.18):
 *   node --env-file=.env.local scripts/respaldo-documentos.mts --destino "<carpeta fuera de cualquier repo>"
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const BUCKET = 'documentos';
// Proyecto Supabase anterior (ya no resuelve DNS). Algunas columnas pudieron
// guardar URLs con ese host; el objeto vive en el proyecto actual con la
// misma ruta. Mismo criterio que scripts/migraciones/2026-11-17-*.mts.
const HOSTS_ANTERIORES = ['https://uafyxhczxbsyzfyjokwf.supabase.co'];
const COLUMNAS = [
  'ruta_ine_frente',
  'ruta_ine_reverso',
  'ruta_acta_nacimiento',
  'ruta_comprobante_domicilio',
] as const;
type Columna = (typeof COLUMNAS)[number];

const PAGINA_LISTADO = 1000;
const PAGINA_REGISTROS = 1000;
const INTENTOS = 3;
const TIMEOUT_MS = 60_000;
const DESCARGAS_SIMULTANEAS = 4;
const MARCADOR_CARPETA = '.emptyFolderPlaceholder';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ObjetoBucket {
  ruta: string;
  tamano: number | null;
  mimetype: string | null;
  etag: string | null;
}

type Registro = {
  id: number;
  nombre: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  correo_electronico: string | null;
  curso: string | null;
  upload_session_id: string | null;
} & Record<Columna, string | null>;

interface Dueno {
  registro: Registro;
  vinculos: string[];
}

interface Resultado {
  objeto: ObjetoBucket;
  rutaLocal: string; // relativa al destino, con '/'
  estado: 'ok' | 'fallo';
  error: string;
  tamanoDescargado: number | null;
  sha256: string;
  etagCoincide: 'sí' | 'no' | 'n/a';
  descargadoEn: string;
  clase: 'con dueño' | 'huérfano' | 'marcador';
  duenos: Dueno[];
}

// ------------------------------------------------------------ credenciales

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Quita la llave de cualquier texto antes de imprimirlo o guardarlo. */
function limpiar(texto: string): string {
  return SERVICE_KEY ? texto.split(SERVICE_KEY).join('[REDACTADO]') : texto;
}

function mensaje(e: unknown): string {
  if (e instanceof Error) return limpiar(e.message);
  if (e && typeof e === 'object' && 'message' in e) return limpiar(String((e as { message: unknown }).message));
  return limpiar(String(e));
}

function cliente(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno (usar node --env-file=.env.local).',
    );
  }
  // Toda petición con timeout: una conexión colgada no debe dejar el
  // respaldo esperando para siempre.
  const fetchConTimeout: typeof fetch = (input, init) => {
    const t = AbortSignal.timeout(TIMEOUT_MS);
    const signal = init?.signal ? AbortSignal.any([init.signal, t]) : t;
    return fetch(input, { ...init, signal });
  };
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchConTimeout },
  });
}

// ------------------------------------------------------------- utilidades

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function conReintentos<T>(descripcion: string, fn: () => Promise<T>): Promise<T> {
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

function argDestino(): string {
  const args = process.argv.slice(2);
  let valor: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--destino') valor = args[++i];
    else if (a.startsWith('--destino=')) valor = a.slice('--destino='.length);
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (!valor || valor.startsWith('--')) {
    throw new Error('Falta --destino "<carpeta>". No hay ruta por defecto.');
  }
  return resolve(valor);
}

function existenteMasCercano(p: string): string {
  let d = p;
  while (!existsSync(d)) {
    const padre = dirname(d);
    if (padre === d) break;
    d = padre;
  }
  return d;
}

/** Devuelve el directorio que contiene .git, subiendo desde `desde`. */
function buscarGit(desde: string): string | null {
  let d = desde;
  while (true) {
    if (existsSync(join(d, '.git'))) return d;
    const padre = dirname(d);
    if (padre === d) return null;
    d = padre;
  }
}

function verificarFueraDeGit(ruta: string): void {
  const base = existenteMasCercano(ruta);
  // Se revisa la ruta tal cual y la real (enlaces simbólicos, junctions).
  for (const candidato of new Set([base, realpathSync.native(base)])) {
    const repo = buscarGit(candidato);
    if (repo) {
      throw new Error(
        `El destino está dentro de un repositorio git (${repo} contiene .git).\n` +
          'Estos archivos son identificaciones oficiales y no deben acabar en un repositorio. Elige una carpeta fuera de cualquier repo.',
      );
    }
  }
}

/**
 * Carpetas que OneDrive sincroniza: variables de entorno y registro de
 * Windows (carpeta de cada cuenta, bibliotecas de SharePoint montadas y
 * carpetas por organización). En Windows, si el registro no se puede leer,
 * se aborta: no se sigue sin saber.
 */
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
      "Get-ChildItem 'HKCU:\\Software\\Microsoft\\OneDrive\\Accounts' -ErrorAction SilentlyContinue | ForEach-Object {",
      '  $uf = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).UserFolder',
      '  if ($uf) { $r += $uf }',
      "  $m = Join-Path $_.PSPath 'ScopeIdToMountPointPathCache'",
      '  if (Test-Path $m) { $k = Get-Item $m; $k.GetValueNames() | ForEach-Object { $r += [string]$k.GetValue($_) } }',
      "  $t = Join-Path $_.PSPath 'Tenants'",
      "  if (Test-Path $t) { Get-ChildItem $t | ForEach-Object { $_.GetValueNames() | Where-Object { $_ -match '^[A-Za-z]:\\\\' } | ForEach-Object { $r += $_ } } }",
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
    let lista: unknown;
    try {
      lista = JSON.parse(salida.trim() || '[]');
    } catch {
      throw new Error('No se pudo interpretar la lista de carpetas de OneDrive leída del registro.');
    }
    if (!Array.isArray(lista)) throw new Error('Lista de carpetas de OneDrive con formato inesperado.');
    for (const v of lista) if (typeof v === 'string' && v.trim()) raices.add(v.trim());
  }
  return [...raices].map((r) => resolve(r));
}

function dentroDe(ruta: string, raiz: string): boolean {
  const a = ruta.toLowerCase();
  const b = raiz.toLowerCase().replace(/[\\/]+$/, '');
  return a === b || a.startsWith(b + sep);
}

function verificarFueraDeOneDrive(ruta: string, raices: string[]): void {
  const base = existenteMasCercano(ruta);
  const candidatos = new Set([ruta, base, realpathSync.native(base)]);
  const raicesReales = new Set(raices);
  for (const r of raices) if (existsSync(r)) raicesReales.add(realpathSync.native(r));
  for (const c of candidatos) {
    const raiz = [...raicesReales].find((r) => dentroDe(c, r));
    // Respaldo por nombre: cualquier carpeta "OneDrive" u "OneDrive - <org>".
    const porNombre = c.split(/[\\/]/).find((s) => /^onedrive( - .+)?$/i.test(s));
    if (raiz || porNombre) {
      throw new Error(
        `El destino está dentro de una carpeta sincronizada por OneDrive (${raiz ?? porNombre}).\n` +
          'Estos archivos son identificaciones de alumnas y no deben acabar en una nube personal. Elige una carpeta local no sincronizada.',
      );
    }
  }
}

function prepararDestino(destino: string): void {
  const oneDrive = carpetasOneDrive();
  console.log(`Carpetas de OneDrive detectadas: ${oneDrive.length ? oneDrive.join(' ; ') : '(ninguna)'}`);
  verificarFueraDeGit(destino);
  verificarFueraDeOneDrive(destino, oneDrive);
  if (existsSync(destino)) {
    if (!statSync(destino).isDirectory()) throw new Error(`El destino existe y no es una carpeta: ${destino}`);
    if (readdirSync(destino).length > 0) {
      throw new Error(`El destino no está vacío: ${destino}\nUsa una carpeta nueva para no mezclar copias.`);
    }
  }
  mkdirSync(destino, { recursive: true });
  // De nuevo, ya con la ruta real creada (enlaces, junctions).
  verificarFueraDeGit(destino);
  verificarFueraDeOneDrive(destino, oneDrive);
}

/** Convierte el valor de una columna ruta_* a la ruta del objeto en el bucket. */
function aRuta(valor: string): { ruta: string } | { fuera: string } {
  const v = valor.trim();
  if (/^https?:\/\//i.test(v)) {
    const marca = [SUPABASE_URL, ...HOSTS_ANTERIORES]
      .map((h) => `${h}/storage/v1/object/public/${BUCKET}/`)
      .find((m) => v.startsWith(m));
    if (!marca) return { fuera: 'URL de otro host o de otro bucket' };
    let resto = v.slice(marca.length).split(/[?#]/)[0];
    try {
      resto = decodeURIComponent(resto);
    } catch {
      return { fuera: 'URL con codificación inválida' };
    }
    return { ruta: resto };
  }
  return { ruta: v.replace(/^\/+/, '') };
}

// Nombres que Windows no puede crear. Se codifican como %XX (el '%' también,
// para que la conversión no tenga ambigüedad); la ruta local real queda en el
// manifiesto, junto a la ruta en Storage.
const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const hex = (c: string) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');

function escaparSegmento(s: string): string {
  if (s === '') return '%vacio';
  let r = s.replace(/[%<>:"\\|?*\x00-\x1f]/g, hex);
  r = r.replace(/[. ]+$/, (m) => [...m].map(hex).join(''));
  if (RESERVADOS_WINDOWS.test(r)) r = hex(r[0]) + r.slice(1);
  return r;
}

function construirRutaLocal(ruta: string, usadas: Set<string>): string {
  const segmentos = ruta.split('/').map(escaparSegmento);
  let rel = [BUCKET, ...segmentos].join('/');
  // Windows no distingue mayúsculas: dos objetos que solo difieren en eso
  // chocarían. El segundo recibe sufijo y queda registrado en el manifiesto.
  if (usadas.has(rel.toLowerCase())) {
    const punto = rel.lastIndexOf('.');
    const conExt = punto > rel.lastIndexOf('/');
    for (let n = 2; ; n++) {
      const cand = conExt ? `${rel.slice(0, punto)}__${n}${rel.slice(punto)}` : `${rel}__${n}`;
      if (!usadas.has(cand.toLowerCase())) {
        rel = cand;
        break;
      }
    }
  }
  usadas.add(rel.toLowerCase());
  return rel;
}

function csv(valor: string | number | null): string {
  let s = valor === null ? '' : String(valor);
  // Los nombres vienen de un formulario público: evitar que Excel los
  // interprete como fórmula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// ----------------------------------------------------------------- lectura

async function listarBucket(sb: SupabaseClient): Promise<{ objetos: ObjetoBucket[]; carpetas: Set<string> }> {
  const objetos: ObjetoBucket[] = [];
  const carpetas = new Set<string>();
  const vistas = new Set<string>();
  const pendientes: string[] = [''];

  while (pendientes.length > 0) {
    const carpeta = pendientes.shift() as string;
    for (let offset = 0; ; offset += PAGINA_LISTADO) {
      const pagina = await conReintentos(`Listar "${carpeta || '/'}" desde ${offset}`, async () => {
        const { data, error } = await sb.storage
          .from(BUCKET)
          .list(carpeta, { limit: PAGINA_LISTADO, offset, sortBy: { column: 'name', order: 'asc' } });
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
          });
        }
      }
      if (pagina.length < PAGINA_LISTADO) break;
    }
  }
  return { objetos, carpetas };
}

async function leerRegistros(sb: SupabaseClient): Promise<Registro[]> {
  const campos = [
    'id',
    'nombre',
    'apellido_paterno',
    'apellido_materno',
    'correo_electronico',
    'curso',
    'upload_session_id',
    ...COLUMNAS,
  ].join(',');
  const filas: Registro[] = [];
  for (let desde = 0; ; desde += PAGINA_REGISTROS) {
    const lote = await conReintentos(`Leer registros desde ${desde}`, async () => {
      const { data, error } = await sb
        .from('registros')
        .select(campos)
        .order('id', { ascending: true })
        .range(desde, desde + PAGINA_REGISTROS - 1);
      if (error) throw error;
      return (data ?? []) as unknown as Registro[];
    });
    filas.push(...lote);
    if (lote.length < PAGINA_REGISTROS) break;
  }
  return filas;
}

async function descargar(sb: SupabaseClient, ruta: string): Promise<Buffer> {
  return conReintentos('Descargar', async () => {
    const { data, error } = await sb.storage.from(BUCKET).download(ruta);
    if (error) throw error;
    if (!data) throw new Error('respuesta sin contenido');
    return Buffer.from(await data.arrayBuffer());
  });
}

// -------------------------------------------------------------------- main

async function main(): Promise<number> {
  // Lo primero: contra qué proyecto se corre. Si la variable ya existía en la
  // terminal, Node la usa en lugar de la de --env-file. Solo la URL, nunca la
  // llave.
  console.log(`Proyecto Supabase: ${SUPABASE_URL || '(sin NEXT_PUBLIC_SUPABASE_URL)'}`);
  const destino = argDestino();
  const sb = cliente();
  prepararDestino(destino);

  const marcador = join(destino, 'EN_PROCESO.txt');
  writeFileSync(
    marcador,
    'Respaldo en curso. Si este archivo sigue aquí y el script ya no corre, la copia está INCOMPLETA: borra la carpeta y vuelve a correrlo.\n',
    'utf8',
  );

  const inicio = new Date();
  console.log(`Destino: ${destino}\n`);

  console.log('Listando el bucket completo...');
  const { objetos, carpetas } = await listarBucket(sb);
  console.log(`  ${objetos.length} objetos en ${carpetas.size} carpetas.`);

  console.log('Leyendo registros (solo SELECT)...');
  const registros = await leerRegistros(sb);
  console.log(`  ${registros.length} registros.\n`);

  // Índices de propiedad
  const porSesion = new Map<string, Registro[]>();
  const refsPorRuta = new Map<string, { registro: Registro; columna: Columna }[]>();
  const refsFueraDelBucket: { registroId: number; columna: Columna; motivo: string }[] = [];
  for (const r of registros) {
    if (r.upload_session_id) {
      const k = r.upload_session_id.toLowerCase();
      porSesion.set(k, [...(porSesion.get(k) ?? []), r]);
    }
    for (const col of COLUMNAS) {
      const valor = r[col];
      if (!valor || !valor.trim()) continue;
      const n = aRuta(valor);
      if ('fuera' in n) {
        refsFueraDelBucket.push({ registroId: r.id, columna: col, motivo: n.fuera });
        continue;
      }
      refsPorRuta.set(n.ruta, [...(refsPorRuta.get(n.ruta) ?? []), { registro: r, columna: col }]);
    }
  }

  const rutasEnBucket = new Set(objetos.map((o) => o.ruta));
  const refsRotas: { registroId: number; columna: Columna; ruta: string }[] = [];
  for (const [ruta, refs] of refsPorRuta) {
    if (rutasEnBucket.has(ruta)) continue;
    for (const ref of refs) refsRotas.push({ registroId: ref.registro.id, columna: ref.columna, ruta });
  }
  refsRotas.sort((a, b) => a.registroId - b.registroId || a.columna.localeCompare(b.columna));

  // Descargas
  const usadas = new Set<string>();
  const ordenados = [...objetos].sort((a, b) => a.ruta.localeCompare(b.ruta, 'es', { numeric: true }));
  const planes = ordenados.map((o) => ({ objeto: o, rutaLocal: construirRutaLocal(o.ruta, usadas) }));
  const resultados: Resultado[] = new Array(planes.length);
  const baseAbs = resolve(destino);

  let siguiente = 0;
  let hechos = 0;
  async function trabajador(): Promise<void> {
    while (siguiente < planes.length) {
      const i = siguiente++;
      const { objeto: o, rutaLocal } = planes[i];

      // Dueños: por columnas ruta_* y, en temp/{uuid}/, por upload_session_id.
      const duenos = new Map<number, Dueno>();
      for (const ref of refsPorRuta.get(o.ruta) ?? []) {
        const d = duenos.get(ref.registro.id) ?? { registro: ref.registro, vinculos: [] };
        d.vinculos.push(ref.columna);
        duenos.set(ref.registro.id, d);
      }
      const partes = o.ruta.split('/');
      if (partes[0] === 'temp' && partes.length >= 3 && UUID_RE.test(partes[1])) {
        for (const r of porSesion.get(partes[1].toLowerCase()) ?? []) {
          const d = duenos.get(r.id) ?? { registro: r, vinculos: [] };
          d.vinculos.push('upload_session_id');
          duenos.set(r.id, d);
        }
      }
      const esMarcador = o.ruta.endsWith(`/${MARCADOR_CARPETA}`) || o.ruta === MARCADOR_CARPETA;

      const res: Resultado = {
        objeto: o,
        rutaLocal,
        estado: 'ok',
        error: '',
        tamanoDescargado: null,
        sha256: '',
        etagCoincide: 'n/a',
        descargadoEn: '',
        clase: esMarcador ? 'marcador' : duenos.size > 0 ? 'con dueño' : 'huérfano',
        duenos: [...duenos.values()].sort((a, b) => a.registro.id - b.registro.id),
      };

      try {
        const abs = resolve(baseAbs, ...rutaLocal.split('/'));
        if (!abs.startsWith(baseAbs + sep)) throw new Error('la ruta local saldría del destino');
        const bytes = await descargar(sb, o.ruta);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, bytes, { flag: 'wx' }); // nunca sobrescribe
        res.tamanoDescargado = bytes.length;
        res.sha256 = createHash('sha256').update(bytes).digest('hex');
        res.descargadoEn = new Date().toISOString();
        const etag = (o.etag ?? '').replace(/"/g, '').toLowerCase();
        if (/^[0-9a-f]{32}$/.test(etag)) {
          res.etagCoincide = createHash('md5').update(bytes).digest('hex') === etag ? 'sí' : 'no';
        }
        if (o.tamano !== null && o.tamano !== bytes.length) {
          res.estado = 'fallo';
          res.error = `tamaño distinto: reportado ${o.tamano}, descargado ${bytes.length}`;
        }
      } catch (e) {
        res.estado = 'fallo';
        res.error = mensaje(e);
        res.descargadoEn = new Date().toISOString();
      }
      resultados[i] = res;
      hechos++;
      if (hechos % 25 === 0 || hechos === planes.length) console.log(`  descargados ${hechos}/${planes.length}`);
    }
  }
  console.log('Descargando...');
  await Promise.all(Array.from({ length: Math.min(DESCARGAS_SIMULTANEAS, planes.length) }, trabajador));

  // ---- manifiesto.csv
  const encabezado = [
    'ruta_storage',
    'ruta_local',
    'tamano_reportado',
    'tamano_descargado',
    'sha256',
    'etag_md5_coincide',
    'mimetype',
    'descargado_en',
    'estado',
    'error',
    'clase',
    'vinculo',
    'registro_id',
    'nombre',
    'correo',
    'curso',
  ];
  const lineas = [encabezado.map(csv).join(',')];
  for (const r of resultados) {
    const unir = (f: (d: Dueno) => string) => r.duenos.map(f).join(' | ');
    lineas.push(
      [
        r.objeto.ruta,
        r.rutaLocal,
        r.objeto.tamano,
        r.tamanoDescargado,
        r.sha256,
        r.etagCoincide,
        r.objeto.mimetype,
        r.descargadoEn,
        r.estado,
        r.error,
        r.clase,
        unir((d) => d.vinculos.join('+')),
        unir((d) => String(d.registro.id)),
        unir((d) =>
          [d.registro.nombre, d.registro.apellido_paterno, d.registro.apellido_materno].filter(Boolean).join(' '),
        ),
        unir((d) => d.registro.correo_electronico ?? ''),
        unir((d) => d.registro.curso ?? ''),
      ]
        .map(csv)
        .join(','),
    );
  }
  // BOM para que Excel abra los acentos correctamente.
  writeFileSync(join(destino, 'manifiesto.csv'), '\uFEFF' + lineas.join('\r\n') + '\r\n', 'utf8');

  // ---- sha256sums.txt (formato de sha256sum -c, rutas relativas al destino)
  writeFileSync(
    join(destino, 'sha256sums.txt'),
    resultados
      .filter((r) => r.sha256)
      .map((r) => `${r.sha256} *${r.rutaLocal}`)
      .join('\n') + '\n',
    'utf8',
  );

  // ---- verificación
  const fallos = resultados.filter((r) => r.estado === 'fallo');
  const okBytes = resultados.reduce((s, r) => s + (r.tamanoDescargado ?? 0), 0);
  const descargados = resultados.filter((r) => r.tamanoDescargado !== null).length;
  const etagNo = resultados.filter((r) => r.etagCoincide === 'no');
  const reales = resultados.filter((r) => r.clase !== 'marcador');
  const sinRuta = reales.filter((r) => !refsPorRuta.has(r.objeto.ruta));
  const huerfanos = reales.filter((r) => r.clase === 'huérfano');
  const marcadores = resultados.length - reales.length;
  const renombrados = resultados.filter((r) => r.rutaLocal !== `${BUCKET}/${r.objeto.ruta}`);

  const verificacion = {
    proyecto: SUPABASE_URL,
    inicio: inicio.toISOString(),
    fin: new Date().toISOString(),
    totales: {
      carpetas: carpetas.size,
      objetos: objetos.length,
      descargados,
      bytes: okBytes,
      registros: registros.length,
    },
    fallos: fallos.map((r) => ({ ruta: r.objeto.ruta, error: r.error })),
    referenciasAObjetosInexistentes: refsRotas,
    referenciasFueraDelBucket: refsFueraDelBucket,
    objetosSinRuta: sinRuta.map((r) => ({
      ruta: r.objeto.ruta,
      clase: r.clase,
      registros: r.duenos.map((d) => d.registro.id),
    })),
    huerfanos: huerfanos.map((r) => r.objeto.ruta),
    etagNoCoincide: etagNo.map((r) => r.objeto.ruta),
    rutasLocalesRenombradas: renombrados.map((r) => ({ ruta: r.objeto.ruta, rutaLocal: r.rutaLocal })),
  };
  writeFileSync(join(destino, 'verificacion.json'), JSON.stringify(verificacion, null, 2), 'utf8');

  const mb = (b: number) => (b / (1024 * 1024)).toFixed(2);
  console.log('\n================ VERIFICACIÓN ================');
  console.log(`Proyecto Supabase:          ${SUPABASE_URL}`);
  console.log(`Carpetas en el bucket:      ${carpetas.size}`);
  console.log(`Objetos en el bucket:       ${objetos.length}  (${marcadores} marcadores de carpeta vacía)`);
  console.log(`Archivos descargados:       ${descargados}`);
  console.log(`Megabytes descargados:      ${mb(okBytes)} MB`);
  console.log(`\nNo se pudieron bajar:       ${fallos.length}`);
  for (const r of fallos) console.log(`  ${r.objeto.ruta} — ${r.error}`);
  console.log(`\nruta_* que apuntan a un objeto que NO existe en el bucket: ${refsRotas.length}`);
  for (const x of refsRotas) console.log(`  registro ${x.registroId} · ${x.columna}`);
  console.log(`ruta_* que no apuntan a este bucket (otro host, p. ej. Drive): ${refsFueraDelBucket.length}`);
  for (const x of refsFueraDelBucket) console.log(`  registro ${x.registroId} · ${x.columna} — ${x.motivo}`);
  console.log(`\nObjetos que no aparecen en ninguna ruta_*: ${sinRuta.length}`);
  console.log(`  de ellos, ligados a un registro solo por upload_session_id: ${sinRuta.length - sinRuta.filter((r) => r.clase === 'huérfano').length}`);
  console.log(`  huérfanos (sin registro por ninguna vía):                 ${huerfanos.length}`);
  if (etagNo.length) console.log(`\nAviso: ${etagNo.length} objeto(s) con eTag MD5 distinto del archivo bajado (ver verificacion.json).`);
  if (renombrados.length) console.log(`Aviso: ${renombrados.length} archivo(s) con nombre ajustado para Windows (ver manifiesto, columna ruta_local).`);
  console.log(`\nManifiesto:   ${join(destino, 'manifiesto.csv')}`);
  console.log(`Checksums:    ${join(destino, 'sha256sums.txt')}`);
  console.log(`Verificación: ${join(destino, 'verificacion.json')}`);

  if (fallos.length > 0) {
    renameSync(marcador, join(destino, 'COPIA_CON_FALLOS.txt'));
    writeFileSync(
      join(destino, 'COPIA_CON_FALLOS.txt'),
      `La copia terminó con ${fallos.length} objeto(s) que no se pudieron bajar correctamente. Ver verificacion.json.\n`,
      'utf8',
    );
    console.log(`\nRESULTADO: COPIA CON FALLOS (${fallos.length}).`);
    return 1;
  }
  rmSync(marcador);
  console.log('\nRESULTADO: copia completa, sin fallos de descarga.');
  return 0;
}

main().then(
  (codigo) => {
    process.exitCode = codigo;
  },
  (e) => {
    console.error(`\nABORTADO: ${mensaje(e)}`);
    process.exitCode = 2;
  },
);
