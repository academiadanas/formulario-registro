/**
 * MIGRACIÓN — promoción de documentos de temp/ a registros/ (Pieza B)
 *
 * Objetivo: que ninguna columna ruta_* de `registros` apunte bajo temp/
 * (invariante; ver scripts/verificar-invariante-documentos.mts). Los
 * registros nuevos ya se promueven al inscribirse (src/lib/documentos-
 * registro.ts); esta migración cubre los anteriores y repara fallas de esa
 * promoción.
 *
 * Cumple la regla de CLAUDE.md "Base de datos: Claude Code no la modifica":
 * el script solo lee la base; los UPDATE de ruta_* los GENERA como .sql para
 * que Roberto los revise y los corra.
 *
 * Fases (cada una es una invocación aparte):
 *   1. plan      En seco. Lee registros y el bucket, cruza cada objeto con el
 *                manifiesto del respaldo y escribe el plan. No toca nada.
 *   2. copiar    Copia a registros/{uuid}/ y verifica cada copia (tamaño y
 *                sha256) contra el manifiesto del respaldo. No borra
 *                originales ni toca la base. Si un objeto falla, sigue con
 *                los demás y sale con 1. Solo corre con el código
 *                commiteado; la bitácora registra el commit.
 *   3. sql       Genera el .sql con los UPDATE, SOLO para los objetos que la
 *                fase 2 verificó y cuya copia y columna siguen en
 *                condiciones; avisa fuerte si son menos que los del plan.
 *                Incluye previsualización, bloque todo-o-nada y
 *                comprobación. No lo ejecuta.
 *   4. limpiar   (pendiente) Tras el SQL: verifica y borra los originales.
 *
 * El plan contiene las rutas nuevas (lo único que protege los archivos
 * mientras el bucket sea público): se rehúsa a escribirlo dentro de un repo
 * git o de OneDrive. Va junto al respaldo.
 *
 * Uso (desde la raíz del repo, Node >= 22.18):
 *   node --env-file=.env.local scripts/migraciones/2026-11-19-promocion-temp-a-registros.mts plan \
 *     --manifiesto "D:\respaldos-academia\documentos-AAAA-MM-DD\manifiesto.csv" \
 *     --plan "D:\respaldos-academia\promocion-AAAA-MM-DD\plan.json"
 *   node --env-file=.env.local scripts/migraciones/2026-11-19-promocion-temp-a-registros.mts copiar \
 *     --plan "D:\respaldos-academia\promocion-AAAA-MM-DD\plan.json" \
 *     --bitacora "D:\respaldos-academia\promocion-AAAA-MM-DD\copia-1.jsonl"
 *   node --env-file=.env.local scripts/migraciones/2026-11-19-promocion-temp-a-registros.mts sql \
 *     --plan "D:\respaldos-academia\promocion-AAAA-MM-DD\plan.json" \
 *     --bitacora "D:\respaldos-academia\promocion-AAAA-MM-DD\copia-1.jsonl" \
 *     --sql "D:\respaldos-academia\promocion-AAAA-MM-DD\fase3-update.sql"
 *
 * Códigos de salida: 0 plan sin bloqueos · 1 plan con bloqueos (se guarda,
 * pero las fases siguientes se negarán a usarlo) · 2 error.
 */

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aRuta,
  BUCKET,
  cliente,
  COLUMNAS,
  conReintentos,
  HOSTS_ANTERIORES,
  leerManifiesto,
  leerRegistros,
  listarBucket,
  mensaje,
  sha256Archivo,
  supabaseUrl,
  UUID_RE,
  verificarUbicacionSegura,
  type Columna,
} from '../lib/documentos.mts';

const NOMBRE_SCRIPT = '2026-11-19-promocion-temp-a-registros';
const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHIVOS_DEL_CODIGO = [
  'scripts/migraciones/2026-11-19-promocion-temp-a-registros.mts',
  'scripts/lib/documentos.mts',
];
const REGISTROS_SIMULTANEOS = 3;

type Forma = 'relativa' | 'url';

export interface ItemPlan {
  columna: Columna;
  forma: Forma;
  hostAnterior: boolean;
  valorActual: string;
  origen: string;
  destino: string;
  valorNuevo: string;
  tamano: number;
  mimetype: string | null;
  sha256: string; // del manifiesto del respaldo
}

export interface RegistroPlan {
  registroId: number;
  uploadSessionId: string | null;
  uuidNuevo: string;
  items: ItemPlan[];
}

export interface Bloqueo {
  tipo: string;
  registroId?: number;
  columna?: Columna;
  detalle: string;
}

export interface Plan {
  version: 1;
  script: string;
  generado: string;
  supabaseUrl: string;
  manifiesto: { ruta: string; sha256: string };
  registros: RegistroPlan[];
  bloqueos: Bloqueo[];
}

type Registro = { id: number; upload_session_id: string | null } & Record<Columna, string | null>;

function opcion(nombre: string): string {
  const args = process.argv.slice(3);
  const i = args.indexOf(nombre);
  const v = i === -1 ? undefined : args[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`Falta ${nombre} "<ruta>". No hay ruta por defecto.`);
  return resolve(v);
}

const nombreArchivo = (ruta: string) => ruta.slice(ruta.lastIndexOf('/') + 1);

// ---------------------------------------------------------------- fase 1

async function plan(): Promise<number> {
  const rutaManifiesto = opcion('--manifiesto');
  const rutaPlan = opcion('--plan');

  console.log(`Proyecto Supabase: ${supabaseUrl() || '(sin NEXT_PUBLIC_SUPABASE_URL)'}`);
  if (!existsSync(rutaManifiesto)) throw new Error(`No existe el manifiesto: ${rutaManifiesto}`);
  verificarUbicacionSegura(rutaPlan);
  if (existsSync(rutaPlan)) throw new Error(`El plan ya existe, no se sobrescribe: ${rutaPlan}`);

  const sb = cliente();
  const manifiesto = leerManifiesto(rutaManifiesto);
  const shaManifiesto = sha256Archivo(rutaManifiesto);
  console.log(`Manifiesto: ${rutaManifiesto} (${manifiesto.size} objetos)`);

  const { objetos } = await listarBucket(sb);
  const enBucket = new Map(objetos.map((o) => [o.ruta, o]));
  const registros = await leerRegistros<Registro>(sb, ['id', 'upload_session_id', ...COLUMNAS]);
  console.log(`Registros: ${registros.length} · Objetos en el bucket: ${objetos.length}\n`);

  const bloqueos: Bloqueo[] = [];
  const planes: RegistroPlan[] = [];
  const refsPorOrigen = new Map<string, { registroId: number; columna: Columna }[]>();
  let carpetaDistintaDeSesion = 0;

  for (const r of registros) {
    const items: ItemPlan[] = [];
    const uuidNuevo = randomUUID();
    const nombresDestino = new Set<string>();

    for (const columna of COLUMNAS) {
      const valor = r[columna];
      if (!valor || !valor.trim()) continue;
      const n = aRuta(valor);
      if ('fuera' in n || !n.ruta.startsWith('temp/')) continue;
      const origen = n.ruta;

      refsPorOrigen.set(origen, [...(refsPorOrigen.get(origen) ?? []), { registroId: r.id, columna }]);

      const partes = origen.split('/');
      if (!(partes.length === 3 && UUID_RE.test(partes[1]))) {
        bloqueos.push({ tipo: 'ruta con forma inesperada', registroId: r.id, columna, detalle: 'no es temp/{uuid}/{archivo}' });
        continue;
      }
      if (partes[1].toLowerCase() !== (r.upload_session_id ?? '').toLowerCase()) carpetaDistintaDeSesion++;

      const obj = enBucket.get(origen);
      if (!obj) {
        bloqueos.push({ tipo: 'referencia rota', registroId: r.id, columna, detalle: 'el objeto no existe en el bucket' });
        continue;
      }
      const m = manifiesto.get(origen);
      if (!m) {
        bloqueos.push({ tipo: 'no está en el respaldo', registroId: r.id, columna, detalle: 'el objeto no aparece en el manifiesto' });
        continue;
      }
      if (m.estado !== 'ok' || !/^[0-9a-f]{64}$/.test(m.sha256)) {
        bloqueos.push({ tipo: 'respaldo incompleto', registroId: r.id, columna, detalle: `estado "${m.estado}" en el manifiesto` });
        continue;
      }
      if (obj.tamano === null || obj.tamano !== m.tamano) {
        bloqueos.push({ tipo: 'difiere del respaldo', registroId: r.id, columna, detalle: `tamaño actual ${obj.tamano}, en el respaldo ${m.tamano}` });
        continue;
      }
      if ((obj.mimetype ?? '') !== m.mimetype) {
        bloqueos.push({ tipo: 'difiere del respaldo', registroId: r.id, columna, detalle: `tipo actual ${obj.mimetype}, en el respaldo ${m.mimetype}` });
        continue;
      }

      const nombre = nombreArchivo(origen);
      if (nombresDestino.has(nombre)) {
        bloqueos.push({ tipo: 'nombre repetido en el registro', registroId: r.id, columna, detalle: `dos columnas con el archivo "${nombre}"` });
        continue;
      }
      nombresDestino.add(nombre);

      const destino = `registros/${uuidNuevo}/${nombre}`;
      if (enBucket.has(destino)) {
        bloqueos.push({ tipo: 'destino ocupado', registroId: r.id, columna, detalle: 'ya existe un objeto en el destino' });
        continue;
      }
      const forma = n.forma;
      items.push({
        columna,
        forma,
        hostAnterior: HOSTS_ANTERIORES.some((h) => valor.trim().startsWith(h)),
        valorActual: valor,
        origen,
        destino,
        valorNuevo: forma === 'url' ? sb.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl : destino,
        tamano: obj.tamano,
        mimetype: obj.mimetype,
        sha256: m.sha256,
      });
    }
    if (items.length > 0) {
      planes.push({ registroId: r.id, uploadSessionId: r.upload_session_id, uuidNuevo, items });
    }
  }

  // Objetos referenciados por más de un registro o más de una columna.
  const compartidos = [...refsPorOrigen.entries()].filter(([, refs]) => refs.length > 1);
  for (const [, refs] of compartidos) {
    bloqueos.push({
      tipo: 'objeto compartido',
      registroId: refs[0].registroId,
      detalle: `referenciado por ${refs.map((x) => `registro ${x.registroId}.${x.columna}`).join(', ')}`,
    });
  }

  const p: Plan = {
    version: 1,
    script: NOMBRE_SCRIPT,
    generado: new Date().toISOString(),
    supabaseUrl: supabaseUrl(),
    manifiesto: { ruta: rutaManifiesto, sha256: shaManifiesto },
    registros: planes,
    bloqueos,
  };
  mkdirSync(dirname(rutaPlan), { recursive: true });
  writeFileSync(rutaPlan, JSON.stringify(p, null, 2), { encoding: 'utf8', flag: 'wx' });

  // ---- Reporte (sin rutas: solo números de registro y columnas)
  const items = planes.flatMap((x) => x.items);
  const porForma = (f: Forma) => items.filter((i) => i.forma === f).length;
  const conHostAnterior = items.filter((i) => i.hostAnterior).length;
  const mb = items.reduce((s, i) => s + i.tamano, 0) / (1024 * 1024);
  const enTemp = objetos.filter((o) => o.ruta.startsWith('temp/')).length;
  const tiposBloqueo = [...new Set(bloqueos.map((b) => b.tipo))];

  console.log('================ PLAN (EN SECO: no se copió ni escribió nada en Supabase) ================');
  console.log(`Registros que entran:            ${planes.length}`);
  console.log(`Objetos a copiar:                ${items.length}  (${mb.toFixed(1)} MB)`);
  console.log(`Columnas a actualizar (en el SQL): ${items.length}`);
  console.log(`  con ruta relativa:             ${porForma('relativa')}`);
  console.log(`  con URL completa:              ${porForma('url')}${conHostAnterior ? `  (${conHostAnterior} con host del proyecto anterior → se reescriben al actual)` : ''}`);
  console.log(`Objetos referenciados por más de un registro o columna: ${compartidos.length}`);
  for (const [, refs] of compartidos) console.log(`  ${refs.map((x) => `registro ${x.registroId}.${x.columna}`).join(', ')}`);
  const rotas = bloqueos.filter((b) => b.tipo === 'referencia rota');
  console.log(`Referencias rotas (ruta_* bajo temp/ a objeto inexistente): ${rotas.length}`);
  for (const b of rotas) console.log(`  registro ${b.registroId} · ${b.columna}`);
  const contraRespaldo = bloqueos.filter((b) => /respaldo/.test(b.tipo)).length;
  console.log(`Contra el respaldo: ${items.length} objetos coinciden en tamaño y tipo y tienen sha256 de referencia; ${contraRespaldo} con problemas`);
  console.log(`Carpeta de temp/ distinta del upload_session_id del registro (informativo): ${carpetaDistintaDeSesion}`);
  console.log(`Objetos en temp/ que NO entran (sin ruta_* que los use; huérfanos): ${enTemp - items.length}`);
  console.log(`\nRegistros: ${planes.map((x) => x.registroId).join(', ') || '(ninguno)'}`);

  console.log(`\nBLOQUEOS: ${bloqueos.length}`);
  for (const t of tiposBloqueo) {
    const deTipo = bloqueos.filter((b) => b.tipo === t);
    console.log(`  ${t}: ${deTipo.length}`);
    for (const b of deTipo) console.log(`    registro ${b.registroId ?? '?'}${b.columna ? ` · ${b.columna}` : ''} — ${b.detalle}`);
  }

  console.log(`\nPlan guardado en: ${rutaPlan}`);
  console.log(`sha256 del manifiesto usado: ${shaManifiesto}`);
  if (bloqueos.length > 0) {
    console.log('\nRESULTADO: PLAN CON BLOQUEOS. Las fases siguientes se negarán a usarlo.');
    return 1;
  }
  console.log('\nRESULTADO: plan sin bloqueos.');
  return 0;
}

// ------------------------------------------- utilidades de fases 2 a 4

/**
 * Las fases que tocan documentos solo corren con el código commiteado: la
 * bitácora registra el commit, y así se sabe exactamente qué código corrió.
 */
function commitDelCodigo(): string {
  let estado: string;
  let commit: string;
  try {
    estado = execFileSync('git', ['-C', RAIZ_REPO, 'status', '--porcelain', '--', ...ARCHIVOS_DEL_CODIGO], { encoding: 'utf8' });
    commit = execFileSync('git', ['-C', RAIZ_REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (e) {
    throw new Error(`No se pudo consultar git: ${mensaje(e)}`);
  }
  if (estado.trim()) {
    throw new Error(
      `El código de la migración tiene cambios sin commitear:\n${estado}` +
        'Commitéalo antes de tocar documentos: la bitácora registra el commit que corrió.',
    );
  }
  return commit;
}

/** Lee el plan y comprueba que se puede usar: sin bloqueos, mismo proyecto, mismo manifiesto. */
function leerPlanValidado(rutaPlan: string): { p: Plan; shaPlan: string } {
  if (!existsSync(rutaPlan)) throw new Error(`No existe el plan: ${rutaPlan}`);
  const p = JSON.parse(readFileSync(rutaPlan, 'utf8')) as Plan;
  if (p.version !== 1 || p.script !== NOMBRE_SCRIPT) throw new Error('El plan no es de esta migración o de esta versión.');
  if (p.bloqueos.length > 0) throw new Error(`El plan tiene ${p.bloqueos.length} bloqueo(s); genera uno nuevo sin bloqueos.`);
  if (p.supabaseUrl !== supabaseUrl()) throw new Error(`El plan es de ${p.supabaseUrl} y el entorno apunta a ${supabaseUrl()}.`);
  if (!existsSync(p.manifiesto.ruta)) throw new Error(`No existe el manifiesto del plan: ${p.manifiesto.ruta}`);
  if (sha256Archivo(p.manifiesto.ruta) !== p.manifiesto.sha256) {
    throw new Error('El manifiesto del respaldo cambió desde que se generó el plan; no se puede usar como referencia.');
  }
  return { p, shaPlan: sha256Archivo(rutaPlan) };
}

function abrirBitacora(ruta: string, inicio: Record<string, unknown>): (linea: Record<string, unknown>) => void {
  verificarUbicacionSegura(ruta);
  if (existsSync(ruta)) throw new Error(`La bitácora ya existe, no se sobrescribe: ${ruta}`);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify({ t: new Date().toISOString(), tipo: 'inicio', ...inicio }) + '\n', { encoding: 'utf8', flag: 'wx' });
  return (linea) => appendFileSync(ruta, JSON.stringify({ t: new Date().toISOString(), ...linea }) + '\n', 'utf8');
}

async function existe(sb: SupabaseClient, ruta: string): Promise<boolean> {
  const { data } = await sb.storage.from(BUCKET).exists(ruta);
  return data === true;
}

async function descargar(sb: SupabaseClient, ruta: string): Promise<Blob> {
  return conReintentos('Descargar', async () => {
    const { data, error } = await sb.storage.from(BUCKET).download(ruta);
    if (error) throw error;
    if (!data) throw new Error('respuesta sin contenido');
    return data;
  });
}

// ---------------------------------------------------------------- fase 2

type EstadoItem = 'verificado' | 'fallo' | 'omitido';

interface ResultadoItem {
  registroId: number;
  columna: Columna;
  estado: EstadoItem;
  motivo: string;
  yaExistia: boolean;
}

/**
 * Copia cada objeto del plan a su destino y verifica la copia descargándola
 * y comparando tamaño y sha256 contra el MANIFIESTO DEL RESPALDO (fuente
 * independiente del original) y el tipo contra el del plan. No borra
 * originales ni toca la base.
 *
 * Ante una falla sigue con los demás; al final reporta cada falla con su
 * registro y columna y sale con 1. Se puede volver a correr con una
 * bitácora nueva: las copias que ya existan se vuelven a verificar en vez
 * de copiarse.
 */
async function copiar(): Promise<number> {
  const rutaPlan = opcion('--plan');
  const rutaBitacora = opcion('--bitacora');

  console.log(`Proyecto Supabase: ${supabaseUrl() || '(sin NEXT_PUBLIC_SUPABASE_URL)'}`);
  const commit = commitDelCodigo();
  const { p, shaPlan } = leerPlanValidado(rutaPlan);
  const total = p.registros.reduce((s, r) => s + r.items.length, 0);
  const anotar = abrirBitacora(rutaBitacora, {
    fase: 'copiar',
    commit,
    proyecto: p.supabaseUrl,
    plan: rutaPlan,
    shaPlan,
    shaManifiesto: p.manifiesto.sha256,
    total,
  });
  console.log(`Commit: ${commit}`);
  console.log(`Plan: ${rutaPlan} (${p.registros.length} registros, ${total} objetos)`);
  console.log(`Bitácora: ${rutaBitacora}\n`);

  const sb = cliente();
  const bucket = sb.storage.from(BUCKET);
  const resultados: ResultadoItem[] = [];
  let hechos = 0;

  async function procesarRegistro(r: RegistroPlan): Promise<void> {
    // La columna debe seguir apuntando al original del plan; si alguien la
    // cambió (p. ej. desde Control Escolar), ese objeto no se toca.
    let fila: Record<string, string | null> | null = null;
    let errorFila = '';
    try {
      fila = await conReintentos(`Leer registro ${r.registroId}`, async () => {
        const { data, error } = await sb
          .from('registros')
          .select(r.items.map((i) => i.columna).join(','))
          .eq('id', r.registroId)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as Record<string, string | null> | null;
      });
    } catch (e) {
      errorFila = mensaje(e);
    }

    for (const item of r.items) {
      const res: ResultadoItem = { registroId: r.registroId, columna: item.columna, estado: 'fallo', motivo: '', yaExistia: false };
      let shaCopia = '';
      try {
        if (errorFila) throw new Error(`no se pudo leer el registro: ${errorFila}`);
        if (!fila) {
          res.estado = 'omitido';
          res.motivo = 'el registro ya no existe';
        } else if (fila[item.columna] !== item.valorActual) {
          res.estado = 'omitido';
          res.motivo = 'la columna cambió desde el plan';
        } else {
          // 1. Copiar (o reutilizar la copia de una corrida anterior).
          res.yaExistia = await existe(sb, item.destino);
          if (!res.yaExistia) {
            const { error } = await bucket.copy(item.origen, item.destino);
            // Si la copia respondió error pero sí se completó, se verifica igual.
            if (error && !(await existe(sb, item.destino))) throw new Error(`copia: ${mensaje(error)}`);
          }

          // 2. Verificar contra el respaldo.
          const blob = await descargar(sb, item.destino);
          const bytes = Buffer.from(await blob.arrayBuffer());
          shaCopia = createHash('sha256').update(bytes).digest('hex');
          let problema = '';
          if (bytes.length !== item.tamano) problema = `tamaño ${bytes.length}, esperado ${item.tamano}`;
          else if (shaCopia !== item.sha256) problema = 'sha256 distinto del respaldo';
          else if (item.mimetype && blob.type && blob.type !== item.mimetype) problema = `tipo ${blob.type}, esperado ${item.mimetype}`;

          if (problema) {
            // La copia mala no la referencia nadie (la columna sigue en el
            // original, comprobado arriba): se borra para que una nueva
            // corrida la vuelva a copiar.
            const { error: errBorrar } = await bucket.remove([item.destino]);
            res.motivo = `${problema}; ${errBorrar ? 'la copia mala NO se pudo borrar' : 'copia mala borrada'}`;
          } else {
            res.estado = 'verificado';
          }
        }
      } catch (e) {
        res.estado = 'fallo';
        res.motivo = mensaje(e);
      }
      resultados.push(res);
      anotar({
        tipo: 'item',
        registroId: r.registroId,
        columna: item.columna,
        origen: item.origen,
        destino: item.destino,
        estado: res.estado,
        motivo: res.motivo,
        yaExistia: res.yaExistia,
        sha256Copia: shaCopia,
        sha256Respaldo: item.sha256,
      });
      hechos++;
      if (hechos % 10 === 0 || hechos === total) console.log(`  procesados ${hechos}/${total}`);
    }
  }

  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < p.registros.length) await procesarRegistro(p.registros[siguiente++]);
  };
  console.log('Copiando y verificando...');
  await Promise.all(Array.from({ length: Math.min(REGISTROS_SIMULTANEOS, p.registros.length) }, trabajador));

  const verificados = resultados.filter((x) => x.estado === 'verificado');
  const fallos = resultados.filter((x) => x.estado === 'fallo');
  const omitidos = resultados.filter((x) => x.estado === 'omitido');
  anotar({ tipo: 'fin', verificados: verificados.length, fallos: fallos.length, omitidos: omitidos.length, total });

  const orden = (a: ResultadoItem, b: ResultadoItem) => a.registroId - b.registroId || a.columna.localeCompare(b.columna);
  console.log('\n================ FASE 2: COPIA Y VERIFICACIÓN (no se borró ningún original ni se tocó la base) ================');
  console.log(`Verificados contra el respaldo: ${verificados.length} de ${total}` +
    (verificados.some((x) => x.yaExistia) ? `  (${verificados.filter((x) => x.yaExistia).length} ya existían de una corrida anterior)` : ''));
  console.log(`Fallos:   ${fallos.length}`);
  for (const x of fallos.sort(orden)) console.log(`  registro ${x.registroId} · ${x.columna} — ${x.motivo}`);
  console.log(`Omitidos: ${omitidos.length}`);
  for (const x of omitidos.sort(orden)) console.log(`  registro ${x.registroId} · ${x.columna} — ${x.motivo}`);
  console.log(`\nBitácora: ${rutaBitacora}`);
  if (verificados.length === total) {
    console.log('\nRESULTADO: los objetos del plan quedaron copiados y verificados.');
    return 0;
  }
  console.log(`\nRESULTADO: COPIA PARCIAL — ${total - verificados.length} objeto(s) sin verificar. La fase 3 solo generará UPDATE para los ${verificados.length} verificados.`);
  return 1;
}

// ---------------------------------------------------------------- fase 3

interface LineaBitacora {
  tipo: string;
  fase?: string;
  commit?: string;
  proyecto?: string;
  shaPlan?: string;
  registroId?: number;
  columna?: Columna;
  origen?: string;
  destino?: string;
  estado?: EstadoItem;
  motivo?: string;
  sha256Copia?: string;
  sha256Respaldo?: string;
}

const sqlTexto = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** CASE que devuelve el valor actual de la columna indicada en `c.columna`. */
const casoColumna = (alias: string) =>
  `case c.columna\n${COLUMNAS.map((col) => `           when '${col}' then ${alias}.${col}`).join('\n')}\n         end`;

interface Excluido {
  registroId: number;
  columna: Columna;
  motivo: string;
}

/**
 * Genera el .sql con los UPDATE de ruta_* SOLO para los objetos que la fase
 * 2 verificó y que siguen en condiciones (copia existente, columna sin
 * cambios). No ejecuta nada en la base: el archivo lo revisa y lo corre
 * Roberto. Si quedan menos que los del plan, lo avisa en pantalla, en el
 * encabezado del .sql y en un raise notice.
 */
async function generarSql(): Promise<number> {
  const rutaPlan = opcion('--plan');
  const rutaBitacora = opcion('--bitacora');
  const rutaSql = opcion('--sql');

  console.log(`Proyecto Supabase: ${supabaseUrl() || '(sin NEXT_PUBLIC_SUPABASE_URL)'}`);
  const commit = commitDelCodigo();
  const { p, shaPlan } = leerPlanValidado(rutaPlan);
  verificarUbicacionSegura(rutaSql);
  if (existsSync(rutaSql)) throw new Error(`El .sql ya existe, no se sobrescribe: ${rutaSql}`);

  // La bitácora debe ser de una corrida COMPLETA de la fase 2 sobre ESTE plan.
  if (!existsSync(rutaBitacora)) throw new Error(`No existe la bitácora: ${rutaBitacora}`);
  const lineas = readFileSync(rutaBitacora, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as LineaBitacora);
  const inicio = lineas[0];
  if (inicio?.tipo !== 'inicio' || inicio.fase !== 'copiar') throw new Error('La bitácora no empieza con el inicio de una fase 2.');
  if (inicio.shaPlan !== shaPlan) throw new Error('La bitácora es de otro plan (o el plan cambió después de la fase 2).');
  if (inicio.proyecto !== p.supabaseUrl) throw new Error('La bitácora es de otro proyecto.');
  if (lineas.at(-1)?.tipo !== 'fin') throw new Error('La bitácora no tiene línea de cierre: la fase 2 no terminó.');
  const shaBitacora = sha256Archivo(rutaBitacora);

  const resultado = new Map<string, LineaBitacora>();
  for (const l of lineas) if (l.tipo === 'item') resultado.set(`${l.registroId}|${l.columna}`, l);

  const sb = cliente();
  const total = p.registros.reduce((s, r) => s + r.items.length, 0);
  const excluidos: Excluido[] = [];
  const incluidos: { registroId: number; items: ItemPlan[] }[] = [];

  for (const r of p.registros) {
    // Valores actuales en la base (solo SELECT).
    const fila = await conReintentos(`Leer registro ${r.registroId}`, async () => {
      const { data, error } = await sb
        .from('registros')
        .select(r.items.map((i) => i.columna).join(','))
        .eq('id', r.registroId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Record<string, string | null> | null;
    });

    const items: ItemPlan[] = [];
    for (const item of r.items) {
      const l = resultado.get(`${r.registroId}|${item.columna}`);
      const excluir = (motivo: string) => excluidos.push({ registroId: r.registroId, columna: item.columna, motivo });
      if (!l) { excluir('no aparece en la bitácora'); continue; }
      if (l.estado !== 'verificado') { excluir(`fase 2: ${l.estado}${l.motivo ? ` (${l.motivo})` : ''}`); continue; }
      if (l.origen !== item.origen || l.destino !== item.destino) { excluir('la bitácora no coincide con el plan'); continue; }
      if (!l.sha256Copia || l.sha256Copia !== item.sha256) { excluir('sha256 de la copia distinto del respaldo'); continue; }
      if (!fila) { excluir('el registro ya no existe'); continue; }
      if (fila[item.columna] !== item.valorActual) { excluir('la columna cambió desde el plan'); continue; }
      if (!(await existe(sb, item.destino))) { excluir('la copia ya no existe en Storage'); continue; }
      items.push(item);
    }
    if (items.length > 0) incluidos.push({ registroId: r.registroId, items });
  }

  const nIncluidos = incluidos.reduce((s, r) => s + r.items.length, 0);
  const parcial = nIncluidos < total;
  const ahora = new Date().toISOString();

  // ---- Construcción del .sql
  const valores = incluidos
    .flatMap((r) => r.items.map((i) => `  (${r.registroId}, ${sqlTexto(i.columna)}, ${sqlTexto(i.valorActual)}, ${sqlTexto(i.valorNuevo)})`))
    .join(',\n');
  const cte = `with cambios(registro_id, columna, valor_actual_plan, valor_nuevo) as (values\n${valores}\n)`;

  const aviso = parcial
    ? [
        '-- ############################################################################',
        `-- ##  ATENCIÓN: MIGRACIÓN PARCIAL. Este archivo actualiza ${nIncluidos} de ${total} columnas.`,
        `-- ##  ${total - nIncluidos} columna(s) se quedan en temp/ (la Pieza C las seguirá reportando):`,
        ...excluidos
          .sort((a, b) => a.registroId - b.registroId || a.columna.localeCompare(b.columna))
          .map((x) => `-- ##    registro ${x.registroId} · ${x.columna} — ${x.motivo}`),
        '-- ############################################################################',
        '',
      ]
    : [];

  const bloques = incluidos
    .map((r) => {
      const set = r.items.map((i) => `${i.columna} = ${sqlTexto(i.valorNuevo)}`).join(',\n         ');
      const where = r.items.map((i) => `${i.columna} = ${sqlTexto(i.valorActual)}`).join('\n     and ');
      return [
        `  update registros`,
        `     set ${set}`,
        `   where id = ${r.registroId}`,
        `     and ${where};`,
        `  get diagnostics n = row_count;`,
        `  if n <> 1 then raise exception 'Registro ${r.registroId}: se esperaba 1 fila y se actualizaron %. No se aplicó NADA.', n; end if;`,
      ].join('\n');
    })
    .join('\n\n');

  const sql = [
    '-- ============================================================================',
    '-- Promoción de documentos temp/ → registros/ — FASE 3: UPDATE de ruta_*',
    `-- Generado: ${ahora}`,
    `-- Proyecto: ${p.supabaseUrl}`,
    `-- Código:   ${NOMBRE_SCRIPT}.mts @ ${commit}`,
    `-- Plan:     ${rutaPlan} (sha256 ${shaPlan})`,
    `-- Bitácora: ${rutaBitacora} (sha256 ${shaBitacora})`,
    `-- Cambia:   ${nIncluidos} columna(s) en ${incluidos.length} registro(s) (el plan tenía ${total} en ${p.registros.length}).`,
    '--',
    '-- Lo genera el script; NO lo ejecuta. Contiene las rutas nuevas: no subirlo',
    '-- a ningún repositorio.',
    '-- ============================================================================',
    '',
    ...aviso,
    '-- CÓMO USARLO en el editor SQL de Supabase: "Run" ejecuta TODO el archivo y',
    '-- solo muestra el resultado de la última consulta. Selecciona cada sección',
    '-- y ejecuta solo la selección. El bloque 2 trae un seguro (confirmado := false):',
    '-- mientras no lo cambies a true, aborta sin aplicar nada.',
    '',
    '-- ----------------------------------------------------------------------------',
    '-- 1) PREVISUALIZACIÓN — CORRE ESTO PRIMERO (solo lectura, no cambia nada).',
    '--    Una fila por columna: valor actual en la base, valor nuevo, y si el',
    `--    valor actual es el que vio el plan. "coincide_con_plan" debe ser true en`,
    `--    las ${nIncluidos} filas; si alguna es false, el bloque 2 abortaría.`,
    '-- ----------------------------------------------------------------------------',
    cte,
    'select c.registro_id,',
    "       trim(concat_ws(' ', r.nombre, r.apellido_paterno, r.apellido_materno)) as alumna,",
    '       c.columna,',
    `       ${casoColumna('r')} as valor_actual_en_bd,`,
    '       c.valor_nuevo,',
    `       (${casoColumna('r')}) is not distinct from c.valor_actual_plan as coincide_con_plan`,
    '  from cambios c',
    '  left join registros r on r.id = c.registro_id',
    ' order by c.registro_id, c.columna;',
    '',
    '-- ----------------------------------------------------------------------------',
    '-- 2) APLICAR — todo o nada. Cada UPDATE exige que las columnas sigan con el',
    '--    valor que vio el plan y que afecte exactamente 1 fila; si no, aborta y',
    '--    no se aplica NINGÚN cambio.',
    '--    SEGURO: cambia confirmado a true solo después de revisar la sección 1.',
    '-- ----------------------------------------------------------------------------',
    'do $$',
    'declare',
    '  n int;',
    '  confirmado constant boolean := false;  -- ← cambiar a true para aplicar',
    'begin',
    '  if not confirmado then',
    "    raise exception 'No se aplicó nada: revisa primero la previsualización (sección 1) y luego cambia confirmado a true.';",
    '  end if;',
    '',
    ...(parcial
      ? [`  raise notice 'ATENCIÓN: MIGRACIÓN PARCIAL — se actualizan ${nIncluidos} de ${total} columnas; ${total - nIncluidos} se quedan en temp/.';`, '']
      : []),
    bloques,
    '',
    `  raise notice 'Listo: ${nIncluidos} columna(s) actualizadas en ${incluidos.length} registro(s).';`,
    'end $$;',
    '',
    '-- ----------------------------------------------------------------------------',
    '-- 3) COMPROBACIÓN — después de aplicar (solo lectura).',
    `--    "aplicado" debe ser true en las ${nIncluidos} filas; la cuenta final debe dar ${nIncluidos}.`,
    '-- ----------------------------------------------------------------------------',
    cte,
    'select c.registro_id, c.columna,',
    `       (${casoColumna('r')}) = c.valor_nuevo as aplicado`,
    '  from cambios c',
    '  left join registros r on r.id = c.registro_id',
    ' order by c.registro_id, c.columna;',
    '',
    cte,
    `select count(*) filter (where (${casoColumna('r')}) = c.valor_nuevo) as aplicadas,`,
    '       count(*) as esperadas',
    '  from cambios c',
    '  left join registros r on r.id = c.registro_id;',
    '',
  ].join('\n');

  mkdirSync(dirname(rutaSql), { recursive: true });
  writeFileSync(rutaSql, sql, { encoding: 'utf8', flag: 'wx' });

  // ---- Reporte
  console.log(`Commit: ${commit}`);
  console.log('\n================ FASE 3: SQL GENERADO (no se ejecutó nada en la base) ================');
  console.log(`Columnas en el SQL: ${nIncluidos} de ${total}, en ${incluidos.length} de ${p.registros.length} registros`);
  console.log(`Excluidas: ${excluidos.length}`);
  for (const x of excluidos) console.log(`  registro ${x.registroId} · ${x.columna} — ${x.motivo}`);
  console.log(`\nArchivo: ${rutaSql}`);
  console.log(`sha256:  ${sha256Archivo(rutaSql)}`);
  if (parcial) {
    console.log(`\n!!!!!!!! ATENCIÓN: SQL PARCIAL — ${total - nIncluidos} COLUMNA(S) SE QUEDAN EN temp/ !!!!!!!!`);
    return 1;
  }
  console.log('\nRESULTADO: SQL completo, listo para revisar.');
  return 0;
}

// ------------------------------------------------------------------ main

async function main(): Promise<number> {
  const modo = process.argv[2];
  if (modo === 'plan') return plan();
  if (modo === 'copiar') return copiar();
  if (modo === 'sql') return generarSql();
  if (modo === 'limpiar') {
    throw new Error(`La fase "${modo}" todavía no está implementada.`);
  }
  throw new Error(
    'Uso: plan --manifiesto <csv> --plan <json> | copiar --plan <json> --bitacora <jsonl> | sql --plan <json> --bitacora <jsonl> --sql <archivo.sql>',
  );
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
