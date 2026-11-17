/**
 * MIGRACIÓN DE UN SOLO USO — 17 de noviembre de 2026
 *
 * Problema: el bucket `documentos` es público y los archivos subidos antes del
 * 28-abr-2026 (y las re-subidas desde Control Escolar) viven en rutas derivadas
 * del folio consecutivo: `{folio}/{tipo}_{folio}.{ext}` o
 * `{folio}/{campo}_{timestamp}.{ext}`. Cualquiera puede recorrerlas.
 *
 * Qué hace: mueve todo objeto del bucket que NO esté bajo `temp/` ni bajo
 * `registros/` a `registros/{uuid}/{tipo}.{ext}` y actualiza la columna
 * `ruta_*` de `registros` que lo referencia, conservando su forma (ruta
 * relativa o URL pública completa).
 *
 * Por qué `registros/` y no `temp/`: la herramienta de huérfanos de Control
 * Escolar (app/api/inscripciones/cleanup-orphans) recorre `temp/{uuid}/` y
 * marca para borrar toda carpeta cuyo uuid no coincida con algún
 * `registros.upload_session_id`. Estos archivos no tienen esa correlación.
 *
 * Garantías:
 *  - La columna se actualiza SOLO si el movimiento salió bien. Si la
 *    actualización falla, se revierten las columnas ya cambiadas y el archivo
 *    vuelve a su ruta original.
 *  - Cada UPDATE lleva `.eq(columna, valorAnterior)`: si alguien editó el
 *    registro entre el plan y la ejecución, no se pisa.
 *  - `ejecutar` solo corre un plan generado y revisado antes; no recalcula.
 *
 * Uso (desde la raíz del repo, Node >= 22.18):
 *   node --env-file=.env.local scripts/migraciones/2026-11-17-documentos-ruta-folio.mts plan      --plan <archivo.json>
 *   node --env-file=.env.local scripts/migraciones/2026-11-17-documentos-ruta-folio.mts ejecutar  --plan <archivo.json> --bitacora <archivo.jsonl> --confirmo
 *   node --env-file=.env.local scripts/migraciones/2026-11-17-documentos-ruta-folio.mts verificar --plan <archivo.json>
 *
 * El plan y la bitácora contienen las rutas nuevas (que son lo único que las
 * protege mientras el bucket sea público): guardarlos FUERA del repo.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const BUCKET = 'documentos';
const PREFIJO_NUEVO = 'registros';
// Proyecto Supabase anterior (ya no resuelve DNS). Algunas columnas guardan
// URLs con ese host; el objeto vive en el proyecto actual con la misma ruta.
// Se reconocen como alias y se reescriben con el host actual.
const HOSTS_ANTERIORES = ['https://uafyxhczxbsyzfyjokwf.supabase.co'];
const PREFIJOS_EXCLUIDOS = new Set(['temp', PREFIJO_NUEVO]);
const COLUMNAS = [
  'ruta_ine_frente',
  'ruta_ine_reverso',
  'ruta_acta_nacimiento',
  'ruta_comprobante_domicilio',
] as const;
type Columna = (typeof COLUMNAS)[number];
type Forma = 'relativa' | 'url';

interface Referencia {
  registroId: number;
  columna: Columna;
  forma: Forma;
  valorActual: string;
  valorNuevo: string;
}

interface Movimiento {
  rutaVieja: string;
  rutaNueva: string;
  tamano: number | null;
  mimetype: string | null;
  referencias: Referencia[];
}

interface Plan {
  generado: string;
  supabaseUrl: string;
  prefijoNuevo: string;
  movimientos: Movimiento[];
  ignorados: { ruta: string; motivo: string }[];
  referenciasRotas: { registroId: number; columna: Columna; valor: string; motivo: string }[];
}

interface ObjetoListado {
  ruta: string;
  tamano: number | null;
  mimetype: string | null;
}

// ---------------------------------------------------------------- utilidades

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function cliente(): { sb: SupabaseClient; url: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usar --env-file=.env.local)');
  }
  return {
    sb: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    url: url.replace(/\/+$/, ''),
  };
}

function marcaUrl(): string {
  return `/storage/v1/object/public/${BUCKET}/`;
}

/** Igual que getFileUrl de Control Escolar (registros/[id]/page.tsx). */
function urlComoPanel(supabaseUrl: string, valor: string): string {
  return valor.startsWith('http') ? valor : `${supabaseUrl}${marcaUrl()}${valor}`;
}

/** Convierte el valor de una columna ruta_* a la ruta del objeto en el bucket. */
function aRuta(
  supabaseUrl: string,
  valor: string,
): { ruta: string; forma: Forma } | { error: string } {
  const v = valor.trim();
  if (/^https?:\/\//i.test(v)) {
    const marca = [supabaseUrl, ...HOSTS_ANTERIORES]
      .map((h) => `${h}${marcaUrl()}`)
      .find((m) => v.startsWith(m));
    if (!marca) return { error: 'URL de otro host o de otro bucket' };
    let resto = v.slice(marca.length).split(/[?#]/)[0];
    try {
      resto = decodeURIComponent(resto);
    } catch {
      return { error: 'URL con codificación inválida' };
    }
    return { ruta: resto, forma: 'url' };
  }
  return { ruta: v.replace(/^\/+/, ''), forma: 'relativa' };
}

function extension(nombre: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(nombre);
  return m ? m[1].toLowerCase() : '';
}

function tipoDesdeNombre(nombre: string): string {
  const base = nombre.replace(/\.[A-Za-z0-9]+$/, '');
  const limpio = base
    .replace(/^ruta_/, '')
    .replace(/_\d+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  return limpio || 'archivo';
}

function nombreArchivo(ruta: string): string {
  return ruta.slice(ruta.lastIndexOf('/') + 1);
}

async function listarRecursivo(
  sb: SupabaseClient,
  carpeta: string,
  acc: ObjetoListado[],
): Promise<void> {
  const PAGINA = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(carpeta, { limit: PAGINA, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list("${carpeta}"): ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const ruta = carpeta ? `${carpeta}/${item.name}` : item.name;
      if (item.id === null) {
        if (!carpeta && PREFIJOS_EXCLUIDOS.has(item.name)) continue;
        await listarRecursivo(sb, ruta, acc);
      } else {
        const meta = (item.metadata ?? {}) as { size?: number; mimetype?: string };
        acc.push({ ruta, tamano: meta.size ?? null, mimetype: meta.mimetype ?? null });
      }
    }
    if (data.length < PAGINA) break;
    offset += PAGINA;
  }
}

type FilaRegistro = { id: number } & Record<Columna, string | null>;

async function leerRegistros(sb: SupabaseClient): Promise<FilaRegistro[]> {
  const filas: FilaRegistro[] = [];
  const PAGINA = 1000;
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await sb
      .from('registros')
      .select(['id', ...COLUMNAS].join(','))
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`select registros: ${error.message}`);
    const lote = (data ?? []) as unknown as FilaRegistro[];
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return filas;
}

// ---------------------------------------------------------------------- plan

async function generarPlan(archivoPlan: string): Promise<void> {
  const { sb, url } = cliente();

  const objetos: ObjetoListado[] = [];
  await listarRecursivo(sb, '', objetos);

  const registros = await leerRegistros(sb);

  const ignorados: Plan['ignorados'] = [];
  const referenciasRotas: Plan['referenciasRotas'] = [];
  const porRuta = new Map<string, ObjetoListado>();
  for (const o of objetos) {
    if (nombreArchivo(o.ruta) === '.emptyFolderPlaceholder') {
      ignorados.push({ ruta: o.ruta, motivo: 'marcador de carpeta vacía de Supabase' });
      continue;
    }
    porRuta.set(o.ruta, o);
  }

  // Referencias desde registros hacia objetos fuera de temp/ y registros/
  const refs = new Map<string, Omit<Referencia, 'valorNuevo'>[]>();
  for (const r of registros) {
    for (const col of COLUMNAS) {
      const valor = r[col];
      if (!valor) continue;
      const n = aRuta(url, valor);
      if ('error' in n) {
        referenciasRotas.push({ registroId: r.id, columna: col, valor, motivo: n.error });
        continue;
      }
      const raiz = n.ruta.split('/')[0];
      if (PREFIJOS_EXCLUIDOS.has(raiz)) continue;
      if (!porRuta.has(n.ruta)) {
        referenciasRotas.push({
          registroId: r.id,
          columna: col,
          valor,
          motivo: 'el objeto no existe en el bucket',
        });
        continue;
      }
      const lista = refs.get(n.ruta) ?? [];
      lista.push({ registroId: r.id, columna: col, forma: n.forma, valorActual: valor });
      refs.set(n.ruta, lista);
    }
  }

  // Una carpeta uuid por registro; los objetos sin referencia, una cada uno.
  const uuidPorRegistro = new Map<number, string>();
  const nombresUsados = new Map<string, Set<string>>();
  const movimientos: Movimiento[] = [];

  const ordenados = [...porRuta.values()].sort((a, b) => a.ruta.localeCompare(b.ruta, 'es', { numeric: true }));
  for (const o of ordenados) {
    const refsObj = (refs.get(o.ruta) ?? []).sort((a, b) => a.registroId - b.registroId);

    let uuid: string;
    if (refsObj.length > 0) {
      const principal = refsObj[0].registroId;
      uuid = uuidPorRegistro.get(principal) ?? randomUUID();
      uuidPorRegistro.set(principal, uuid);
    } else {
      uuid = randomUUID();
    }

    const columnasDistintas = new Set(refsObj.map((r) => r.columna));
    const tipo =
      columnasDistintas.size === 1
        ? [...columnasDistintas][0].replace(/^ruta_/, '')
        : tipoDesdeNombre(nombreArchivo(o.ruta));
    const ext = extension(nombreArchivo(o.ruta));

    const usados = nombresUsados.get(uuid) ?? new Set<string>();
    let nombre = ext ? `${tipo}.${ext}` : tipo;
    for (let n = 2; usados.has(nombre); n++) nombre = ext ? `${tipo}_${n}.${ext}` : `${tipo}_${n}`;
    usados.add(nombre);
    nombresUsados.set(uuid, usados);

    const rutaNueva = `${PREFIJO_NUEVO}/${uuid}/${nombre}`;
    const urlNueva = sb.storage.from(BUCKET).getPublicUrl(rutaNueva).data.publicUrl;

    movimientos.push({
      rutaVieja: o.ruta,
      rutaNueva,
      tamano: o.tamano,
      mimetype: o.mimetype,
      referencias: refsObj.map((r) => ({
        ...r,
        valorNuevo: r.forma === 'url' ? urlNueva : rutaNueva,
      })),
    });
  }

  const plan: Plan = {
    generado: new Date().toISOString(),
    supabaseUrl: url,
    prefijoNuevo: PREFIJO_NUEVO,
    movimientos,
    ignorados,
    referenciasRotas,
  };
  writeFileSync(archivoPlan, JSON.stringify(plan, null, 2), 'utf8');

  // ---- Resumen en consola
  console.log(`Proyecto: ${url}`);
  console.log(`Registros leídos: ${registros.length}`);
  console.log(`Objetos fuera de temp/ y ${PREFIJO_NUEVO}/: ${objetos.length}\n`);
  console.log('MOVIMIENTOS (EN SECO — no se movió ni escribió nada en Supabase):');
  movimientos.forEach((m, i) => {
    const kb = m.tamano !== null ? `${Math.round(m.tamano / 1024)} KB` : '? KB';
    console.log(`\n#${i + 1}  ${m.rutaVieja}  (${m.mimetype ?? '?'}, ${kb})`);
    console.log(`    → ${m.rutaNueva}`);
    if (m.referencias.length === 0) {
      console.log('    SIN REFERENCIA en registros: se mueve, no se actualiza ninguna columna');
    }
    for (const r of m.referencias) {
      const hostViejo = HOSTS_ANTERIORES.some((h) => r.valorActual.startsWith(h));
      console.log(`    registro ${r.registroId} · ${r.columna} · ${r.forma}${hostViejo ? ' · HOST ANTERIOR → se reescribe al actual' : ''}`);
      console.log(`      antes:   ${r.valorActual}`);
      console.log(`      después: ${r.valorNuevo}`);
    }
  });
  if (ignorados.length) {
    console.log('\nIGNORADOS:');
    for (const x of ignorados) console.log(`  ${x.ruta} — ${x.motivo}`);
  }
  if (referenciasRotas.length) {
    console.log('\nREFERENCIAS ROTAS (no se tocan):');
    for (const x of referenciasRotas) console.log(`  registro ${x.registroId} · ${x.columna} · ${x.valor} — ${x.motivo}`);
  }
  const sinRef = movimientos.filter((m) => m.referencias.length === 0).length;
  console.log(
    `\nTotal: ${movimientos.length} archivos a mover (${movimientos.length - sinRef} referenciados, ${sinRef} sin referencia), ` +
      `${movimientos.reduce((s, m) => s + m.referencias.length, 0)} columnas a actualizar.`,
  );
  console.log(`Plan guardado en: ${archivoPlan}`);
}

// ------------------------------------------------------------------ ejecutar

function leerPlan(archivo: string): Plan {
  if (!existsSync(archivo)) throw new Error(`No existe el plan: ${archivo}`);
  return JSON.parse(readFileSync(archivo, 'utf8')) as Plan;
}

async function ejecutar(archivoPlan: string, archivoBitacora: string): Promise<void> {
  const { sb, url } = cliente();
  const plan = leerPlan(archivoPlan);
  if (plan.supabaseUrl !== url) throw new Error(`El plan es de ${plan.supabaseUrl}, el entorno apunta a ${url}`);

  const log = (evento: Record<string, unknown>) =>
    appendFileSync(archivoBitacora, JSON.stringify({ t: new Date().toISOString(), ...evento }) + '\n', 'utf8');

  let ok = 0;
  let omitidos = 0;
  let revertidos = 0;
  let criticos = 0;

  for (const m of plan.movimientos) {
    // 1. Precondiciones: origen existe, destino no, columnas sin cambios.
    const origen = await sb.storage.from(BUCKET).exists(m.rutaVieja);
    const destino = await sb.storage.from(BUCKET).exists(m.rutaNueva);
    if (origen.error || !origen.data) {
      log({ estado: 'omitido', rutaVieja: m.rutaVieja, motivo: 'el origen ya no existe' });
      console.log(`OMITIDO  ${m.rutaVieja}: el origen ya no existe`);
      omitidos++;
      continue;
    }
    if (destino.data) {
      log({ estado: 'omitido', rutaVieja: m.rutaVieja, motivo: 'el destino ya existe' });
      console.log(`OMITIDO  ${m.rutaVieja}: el destino ya existe`);
      omitidos++;
      continue;
    }
    let cambiado = false;
    for (const r of m.referencias) {
      const { data, error } = await sb.from('registros').select(r.columna).eq('id', r.registroId).single();
      const actual = (data as Record<string, string | null> | null)?.[r.columna];
      if (error || actual !== r.valorActual) {
        cambiado = true;
        log({ estado: 'omitido', rutaVieja: m.rutaVieja, motivo: `registro ${r.registroId}.${r.columna} cambió desde el plan` });
        console.log(`OMITIDO  ${m.rutaVieja}: registro ${r.registroId}.${r.columna} cambió desde el plan`);
        break;
      }
    }
    if (cambiado) {
      omitidos++;
      continue;
    }

    // 2. Mover. Si falla, nada cambió.
    const mov = await sb.storage.from(BUCKET).move(m.rutaVieja, m.rutaNueva);
    if (mov.error) {
      log({ estado: 'omitido', rutaVieja: m.rutaVieja, motivo: `move falló: ${mov.error.message}` });
      console.log(`OMITIDO  ${m.rutaVieja}: move falló (${mov.error.message})`);
      omitidos++;
      continue;
    }
    log({ estado: 'movido', rutaVieja: m.rutaVieja, rutaNueva: m.rutaNueva });

    // 3. Actualizar columnas, solo después del movimiento exitoso.
    const hechas: Referencia[] = [];
    let fallo: string | null = null;
    for (const r of m.referencias) {
      const { data, error } = await sb
        .from('registros')
        .update({ [r.columna]: r.valorNuevo })
        .eq('id', r.registroId)
        .eq(r.columna, r.valorActual)
        .select('id');
      if (error || !data || data.length !== 1) {
        fallo = error ? error.message : `filas afectadas: ${data?.length ?? 0}`;
        break;
      }
      hechas.push(r);
      log({ estado: 'columna', registroId: r.registroId, columna: r.columna, antes: r.valorActual, despues: r.valorNuevo });
    }

    if (fallo === null) {
      log({ estado: 'ok', rutaVieja: m.rutaVieja, rutaNueva: m.rutaNueva });
      console.log(`OK       ${m.rutaVieja} → ${m.rutaNueva} (${m.referencias.length} columna(s))`);
      ok++;
      continue;
    }

    // 4. Revertir: columnas ya cambiadas y luego el archivo.
    console.log(`FALLO    ${m.rutaVieja}: ${fallo}. Revirtiendo…`);
    let reversionLimpia = true;
    for (const r of hechas.reverse()) {
      const { error } = await sb
        .from('registros')
        .update({ [r.columna]: r.valorActual })
        .eq('id', r.registroId)
        .eq(r.columna, r.valorNuevo);
      if (error) reversionLimpia = false;
      log({ estado: 'columna_revertida', registroId: r.registroId, columna: r.columna, error: error?.message ?? null });
    }
    const atras = await sb.storage.from(BUCKET).move(m.rutaNueva, m.rutaVieja);
    if (atras.error) reversionLimpia = false;
    log({ estado: reversionLimpia ? 'revertido' : 'CRITICO', rutaVieja: m.rutaVieja, rutaNueva: m.rutaNueva, fallo, errorMoveAtras: atras.error?.message ?? null });
    if (reversionLimpia) {
      console.log(`REVERTIDO ${m.rutaVieja}`);
      revertidos++;
    } else {
      console.log(`CRÍTICO  ${m.rutaVieja} ↔ ${m.rutaNueva}: reversión incompleta, revisar a mano con la bitácora`);
      criticos++;
    }
  }

  console.log(`\nOK: ${ok} · omitidos: ${omitidos} · revertidos: ${revertidos} · CRÍTICOS: ${criticos}`);
  console.log(`Bitácora: ${archivoBitacora}`);
  if (criticos > 0) process.exitCode = 2;
}

// ----------------------------------------------------------------- verificar

async function estadoHttp(u: string): Promise<number> {
  const res = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'manual' });
  await res.body?.cancel();
  return res.status;
}

async function verificar(archivoPlan: string): Promise<void> {
  const { sb, url } = cliente();
  const plan = leerPlan(archivoPlan);
  let fallas = 0;
  const bust = () => `?verif=${randomUUID()}`;

  for (const m of plan.movimientos) {
    const nueva = sb.storage.from(BUCKET).getPublicUrl(m.rutaNueva).data.publicUrl;
    const vieja = sb.storage.from(BUCKET).getPublicUrl(m.rutaVieja).data.publicUrl;
    const sNueva = await estadoHttp(nueva);
    const sVieja = await estadoHttp(vieja);
    const sViejaOrigen = await estadoHttp(vieja + bust());

    const nuevaOk = sNueva === 200 || sNueva === 206;
    const noEncontrado = (s: number) => s === 400 || s === 404;
    const lineas = [
      `nueva ${sNueva}${nuevaOk ? '' : ' ✗'}`,
      `vieja ${sVieja}${noEncontrado(sVieja) ? '' : ' ✗'}`,
      `vieja sin caché ${sViejaOrigen}${noEncontrado(sViejaOrigen) ? '' : ' ✗'}`,
    ];
    let ok = nuevaOk && noEncontrado(sVieja) && noEncontrado(sViejaOrigen);

    for (const r of m.referencias) {
      const { data } = await sb.from('registros').select(r.columna).eq('id', r.registroId).single();
      const valor = (data as Record<string, string | null> | null)?.[r.columna] ?? null;
      const enBd = valor === r.valorNuevo;
      const sPanel = valor ? await estadoHttp(urlComoPanel(url, valor)) : 0;
      const panelOk = sPanel === 200 || sPanel === 206;
      lineas.push(`reg ${r.registroId}.${r.columna}: BD ${enBd ? 'ok' : '✗'}, panel ${sPanel}${panelOk ? '' : ' ✗'}`);
      ok = ok && enBd && panelOk;
    }

    if (!ok) fallas++;
    console.log(`${ok ? 'OK  ' : 'FALLA'} ${m.rutaVieja} → ${m.rutaNueva}\n      ${lineas.join(' · ')}`);
  }
  console.log(`\n${plan.movimientos.length - fallas}/${plan.movimientos.length} verificados sin fallas.`);
  if (fallas > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------- main

const modo = process.argv[2];
const archivoPlan = arg('--plan');

try {
  if (!archivoPlan) throw new Error('Falta --plan <archivo.json>');
  if (modo === 'plan') {
    await generarPlan(archivoPlan);
  } else if (modo === 'ejecutar') {
    const bitacora = arg('--bitacora');
    if (!bitacora) throw new Error('Falta --bitacora <archivo.jsonl>');
    if (!process.argv.includes('--confirmo')) throw new Error('ejecutar requiere --confirmo');
    await ejecutar(archivoPlan, bitacora);
  } else if (modo === 'verificar') {
    await verificar(archivoPlan);
  } else {
    throw new Error('Modo inválido: plan | ejecutar | verificar');
  }
} catch (err) {
  console.error('ERROR:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
