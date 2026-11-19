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
 *   2. copiar    (pendiente) Copia a registros/{uuid}/ y verifica cada copia
 *                contra el sha256 del manifiesto. No borra.
 *   3. sql       (pendiente) Genera el .sql con los UPDATE. No lo ejecuta.
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
 *
 * Códigos de salida: 0 plan sin bloqueos · 1 plan con bloqueos (se guarda,
 * pero las fases siguientes se negarán a usarlo) · 2 error.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  aRuta,
  BUCKET,
  cliente,
  COLUMNAS,
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

// ------------------------------------------------------------------ main

async function main(): Promise<number> {
  const modo = process.argv[2];
  if (modo === 'plan') return plan();
  if (modo === 'copiar' || modo === 'sql' || modo === 'limpiar') {
    throw new Error(`La fase "${modo}" todavía no está implementada.`);
  }
  throw new Error('Uso: plan --manifiesto <csv> --plan <json>');
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
