/**
 * AUDITORÍA DE RLS — PRUEBAS DESDE FUERA, SIN ESCRIBIR
 *
 * Complementa scripts/auditoria-rls-consultas.sql (definiciones, que corre
 * Roberto en el SQL Editor). Esto mide el comportamiento real desde fuera,
 * para reescribir desde lo medido las secciones "Políticas RLS en Supabase"
 * y "Pendientes → Política de Storage" de CLAUDE.md.
 *
 * NO escribe nada. Solo hace:
 *   - GET con la llave anónima a tablas (con conteo, sin traer datos) y a
 *     Storage;
 *   - GET a /rest/v1/rpc de una función STABLE (PostgREST la ejecuta en una
 *     transacción de solo lectura);
 *   - lecturas con la llave de servicio (configuración del bucket, elegir un
 *     archivo real para intentar bajarlo como anónimo);
 *   - lectura del código de src/.
 * Deliberadamente NO intenta escrituras anónimas (INSERT/UPDATE en
 * registros, subida directa a Storage): si una política las permitiera, la
 * prueba escribiría. Esas quedan comprobadas por definición (Q2, Q3).
 * Tampoco prueba sesiones `authenticated`: haría falta una cuenta de prueba.
 *
 * Pruebas (las afirmaciones C1..C9 están en el .sql):
 *   P1  SELECT con la llave anónima en registros, catalogos, alumnas ... C3, C4, C5
 *   P2  configuración del bucket documentos ............................. C6, C8
 *   P3  list() del bucket con la llave anónima .......................... C8, C9
 *   P4  descarga de un archivo real con la llave anónima y por URL pública  C6, C8
 *   P5  configuración de registro de cuentas en Auth .................... C7 (contexto)
 *   P6  ¿la llave anónima puede llamar tiene_acceso_control_escolar()? .. C7
 *   P7  qué cliente (llave de servicio o anónima) usa el código para
 *       registros, alumnas, catalogos y el bucket ....................... C1, C2, C5, C6
 *
 * No imprime datos de alumnas, rutas de archivos ni tokens: solo conteos,
 * códigos HTTP, mensajes de error y nombres de archivo del código.
 *
 * Uso (desde la raíz del repo, Node >= 22.18):
 *   node --env-file=.env.local scripts/auditoria-rls-pruebas.mts
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BUCKET, cliente, listarBucket, mensaje, supabaseUrl } from './lib/documentos.mts';

const URL_SB = supabaseUrl();
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (!URL_SB || !ANON || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY (usar --env-file=.env.local).',
  );
  process.exit(2);
}

const anon = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const servicio = cliente();
const ahora = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const limpio = (t: string) => mensaje(t).replace(UUID, '[uuid]').replace(/https?:\/\/\S+/gi, '[url]');

async function cuerpo(res: Response): Promise<string> {
  const t = await res.text().catch(() => '');
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    return limpio(String(j.message ?? j.error ?? t)).slice(0, 160);
  } catch {
    return limpio(t).slice(0, 160);
  }
}

function informe(id: string, que: string, obtenido: string, conclusion: string) {
  console.log(`${id}  ${que}`);
  console.log(`    obtenido:   ${obtenido}`);
  console.log(`    conclusión: ${conclusion}\n`);
}

console.log(`Auditoría RLS — pruebas desde fuera, sin escribir · ${ahora}`);
console.log(`Proyecto: ${URL_SB}\n`);

// ---------------------------------------------------------------- P1
for (const tabla of ['registros', 'catalogos', 'alumnas']) {
  // HEAD con conteo: solo cabeceras, nunca filas.
  const res = await fetch(`${URL_SB}/rest/v1/${tabla}?select=*`, {
    method: 'HEAD',
    headers: { ...anon, Prefer: 'count=exact' },
  });
  const total = (res.headers.get('content-range') ?? '').split('/')[1] ?? '?';
  if (res.ok) {
    informe(
      'P1',
      `SELECT con la llave anónima en ${tabla}`,
      `HTTP ${res.status}, filas visibles: ${total}`,
      total === '0'
        ? `la llave anónima no ve ninguna fila de ${tabla} (tiene permiso de tabla y RLS no le muestra filas, o la tabla está vacía: comparar con Q1-Q3)`
        : `la llave anónima VE ${total} filas de ${tabla}`,
    );
  } else {
    // HEAD no trae cuerpo: se repite como GET solo para leer el mensaje de
    // error (si falló, tampoco trae filas).
    const g = await fetch(`${URL_SB}/rest/v1/${tabla}?select=*&limit=1`, { headers: anon });
    const msg = g.ok ? '(el GET sí respondió; revisar a mano)' : await cuerpo(g);
    if (g.ok) await g.body?.cancel();
    informe(
      'P1',
      `SELECT con la llave anónima en ${tabla}`,
      `HTTP ${res.status}: ${msg}`,
      /permission denied/i.test(msg)
        ? `la llave anónima no tiene permiso de tabla sobre ${tabla}`
        : `la llave anónima no puede leer ${tabla} (ver el mensaje)`,
    );
  }
}

// ---------------------------------------------------------------- P2
{
  const res = await fetch(`${URL_SB}/storage/v1/bucket/${BUCKET}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const b = res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  informe(
    'P2',
    `Configuración del bucket ${BUCKET} (leída con la llave de servicio)`,
    b
      ? `public = ${b.public} · file_size_limit = ${b.file_size_limit} · allowed_mime_types = ${JSON.stringify(b.allowed_mime_types)}`
      : `HTTP ${res.status}: ${await cuerpo(res)}`,
    b ? (b.public === false ? 'el bucket es privado: no hay URL pública que sirva archivos' : 'el bucket es PÚBLICO') : 'no se pudo leer',
  );
}

// ---------------------------------------------------------------- P3
for (const prefix of ['', 'registros/', 'temp/']) {
  const res = await fetch(`${URL_SB}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', // list() es POST en la API de Storage, pero solo lee
    headers: { ...anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });
  const data = res.ok ? ((await res.json()) as unknown[]) : null;
  informe(
    'P3',
    `list() del bucket con la llave anónima, prefijo "${prefix || '/'}"`,
    data ? `HTTP ${res.status}, elementos: ${data.length}` : `HTTP ${res.status}: ${await cuerpo(res)}`,
    data && data.length > 0 ? 'la llave anónima PUEDE listar el bucket' : 'la llave anónima no lista nada del bucket',
  );
}

// ---------------------------------------------------------------- P4
{
  // Elegir un archivo real con la llave de servicio (no se imprime su ruta).
  const { objetos } = await listarBucket(servicio);
  const real = objetos.find((o) => o.ruta.startsWith('registros/') && (o.tamano ?? 0) > 0);
  if (!real) {
    informe('P4', 'Descarga de un archivo real con la llave anónima', 'no hay archivos en registros/ para probar', 'sin dato');
  } else {
    const ruta = encodeURI(real.ruta);
    const a = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${ruta}`, { headers: { ...anon, Range: 'bytes=0-0' } });
    const aTxt = a.ok ? `HTTP ${a.status}, SE DESCARGÓ (${a.headers.get('cf-cache-status') ?? '-'})` : `HTTP ${a.status}: ${await cuerpo(a)}`;
    if (a.ok) await a.body?.cancel();
    informe(
      'P4',
      'Descarga de un archivo real con la llave anónima (endpoint autenticado)',
      aTxt,
      a.ok ? 'la llave anónima PUEDE bajar archivos' : 'la llave anónima no puede bajar archivos',
    );
    const p = await fetch(`${URL_SB}/storage/v1/object/public/${BUCKET}/${ruta}`, { headers: { Range: 'bytes=0-0' } });
    const pTxt = p.ok ? `HTTP ${p.status}, SE SIRVIÓ (${p.headers.get('cf-cache-status') ?? '-'})` : `HTTP ${p.status}: ${await cuerpo(p)}`;
    if (p.ok) await p.body?.cancel();
    informe(
      'P4',
      'El mismo archivo por URL pública, sin llave',
      pTxt,
      p.ok ? 'la URL pública SIRVE el archivo' : 'la URL pública no sirve archivos',
    );
  }
}

// ---------------------------------------------------------------- P5
{
  const res = await fetch(`${URL_SB}/auth/v1/settings`, { headers: { apikey: ANON } });
  const s = res.ok ? ((await res.json()) as { disable_signup?: boolean; mailer_autoconfirm?: boolean; external?: Record<string, unknown> }) : null;
  const activos = s ? Object.entries(s.external ?? {}).filter(([, v]) => v === true).map(([k]) => k) : [];
  informe(
    'P5',
    'Registro de cuentas en Auth (endpoint público de configuración)',
    s
      ? `disable_signup = ${s.disable_signup} · mailer_autoconfirm = ${s.mailer_autoconfirm} · proveedores activos: ${activos.join(', ') || 'ninguno'}`
      : `HTTP ${res.status}: ${await cuerpo(res)}`,
    s
      ? s.disable_signup === false
        ? 'el registro está ABIERTO: cualquiera puede crearse una cuenta y obtener sesión authenticated'
        : 'el registro está cerrado'
      : 'no se pudo leer',
  );
}

// ---------------------------------------------------------------- P6
{
  const res = await fetch(`${URL_SB}/rest/v1/rpc/tiene_acceso_control_escolar`, { headers: anon });
  const txt = res.ok ? `HTTP ${res.status}, devolvió ${await res.text()}` : `HTTP ${res.status}: ${await cuerpo(res)}`;
  informe(
    'P6',
    'Llamar public.tiene_acceso_control_escolar() con la llave anónima',
    txt,
    res.ok
      ? 'la llave anónima PUEDE ejecutar la función de la política de Storage'
      : /permission denied/i.test(txt)
        ? 'la llave anónima no puede ejecutarla (sin permiso EXECUTE)'
        : 'no se pudo ejecutar (ver el mensaje; puede no ser un tema de permisos)',
  );
}

// ---------------------------------------------------------------- P7
{
  const raiz = process.cwd();
  const archivos = (readdirSync(join(raiz, 'src'), { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => join(raiz, 'src', f));
  const usos: string[] = [];
  // .from('tabla') literal, o .from(BUCKET) cuando el archivo define
  // BUCKET = 'documentos' (así lo hace la promoción de documentos).
  const patron = /\.from\(\s*(?:['"](registros|alumnas|catalogos|documentos)['"]|(BUCKET))\s*\)/g;
  for (const f of archivos) {
    const texto = readFileSync(f, 'utf8');
    const bucketEsDocumentos = /\bBUCKET\s*=\s*['"]documentos['"]/.test(texto);
    const cliente = texto.includes('createPublicSupabaseClient')
      ? 'llave de servicio (servidor)'
      : texto.includes('@/lib/supabase-client')
        ? 'llave anónima (navegador)'
        : 'cliente no determinado: revisar a mano';
    for (const m of texto.matchAll(patron)) {
      const nombre = m[1] ?? (bucketEsDocumentos ? 'documentos (vía BUCKET)' : 'BUCKET de valor no reconocido: revisar a mano');
      const linea = texto.slice(0, m.index).split('\n').length;
      usos.push(`${relative(raiz, f).replace(/\\/g, '/')}:${linea} · ${nombre} · ${cliente}`);
    }
  }
  informe(
    'P7',
    'Qué cliente usa el código de src/ para registros, alumnas, catalogos y el bucket documentos',
    `${usos.length} usos`,
    'ver la lista (cada uso con el cliente que crea su archivo)',
  );
  for (const u of usos) console.log(`    ${u}`);
  console.log('');
}

console.log('No comprobado desde fuera (queda por definición, con las consultas del .sql):');
console.log('  - INSERT/UPDATE con la llave anónima en registros (C1, C2): probarlo escribiría. Ver Q1-Q3.');
console.log('  - Subida directa a Storage con la llave anónima, sin URL firmada (C6): ídem. Ver Q2.');
console.log('  - Cualquier operación con sesión authenticated (C7): requiere una cuenta de prueba. Ver Q2 y Q4.');
