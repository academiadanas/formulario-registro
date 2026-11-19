/**
 * VERIFICACIÓN DEL INVARIANTE DE DOCUMENTOS — SOLO LECTURA
 *
 * Invariante: ninguna columna ruta_* de `registros` apunta bajo temp/, y
 * toda ruta_* que apunta al bucket `documentos` corresponde a un objeto que
 * existe. temp/ es solo para subidas en curso o abandonadas.
 *
 * Códigos de salida:
 *   0  el invariante se cumple (puede haber avisos)
 *   1  el invariante está roto: alguna ruta_* apunta bajo temp/ o a un
 *      objeto inexistente
 *   2  no se pudo verificar (error de listado, de lectura o de entorno)
 *
 * No son falla:
 *   - INFORMATIVO: ruta_* que no apuntan a este bucket (los enlaces de Drive
 *     de los registros 23-29), hasta que se migren.
 *   - AVISOS: objetos en temp/ de registros que ya no los usan (sobrantes de
 *     una promoción), objetos en registros/ sin ninguna ruta_* (normales
 *     entre la copia y el SQL de una migración), huérfanos en temp/, objetos
 *     o ruta_* fuera de temp/ y registros/.
 *
 * Solo hace list y select. En pantalla imprime números de registro y
 * columnas, nunca nombres, correos ni rutas de archivos (las rutas son lo
 * único que protege los archivos mientras el bucket sea público).
 *
 * Uso (desde la raíz del repo, Node >= 22.18):
 *   node --env-file=.env.local scripts/verificar-invariante-documentos.mts
 */

import {
  aRuta,
  cliente,
  COLUMNAS,
  leerRegistros,
  listarBucket,
  mensaje,
  supabaseUrl,
  UUID_RE,
  type Columna,
} from './lib/documentos.mts';

const HORAS_HUERFANO = 24;

type Registro = { id: number; upload_session_id: string | null } & Record<Columna, string | null>;

interface Ref {
  registroId: number;
  columna: Columna;
}

/** Agrupa referencias por registro: "registro 40 · ruta_ine_frente, ruta_comprobante_domicilio". */
function porRegistro(refs: Ref[]): string[] {
  const m = new Map<number, Columna[]>();
  for (const r of refs) m.set(r.registroId, [...(m.get(r.registroId) ?? []), r.columna]);
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, cols]) => `  registro ${id} · ${cols.join(', ')}`);
}

function contarRegistros(refs: Ref[]): number {
  return new Set(refs.map((r) => r.registroId)).size;
}

async function main(): Promise<number> {
  console.log(`Proyecto Supabase: ${supabaseUrl() || '(sin NEXT_PUBLIC_SUPABASE_URL)'}`);
  const sb = cliente();

  const { objetos } = await listarBucket(sb);
  const registros = await leerRegistros<Registro>(sb, ['id', 'upload_session_id', ...COLUMNAS]);
  console.log(`Registros: ${registros.length} · Objetos en el bucket: ${objetos.length}\n`);

  const existentes = new Map(objetos.map((o) => [o.ruta, o]));
  const sesiones = new Set(
    registros.map((r) => r.upload_session_id?.toLowerCase()).filter((s): s is string => Boolean(s)),
  );

  const bajoTemp: Ref[] = [];
  const inexistentes: Ref[] = [];
  const fueraDelBucket: (Ref & { host: string })[] = [];
  const fueraDePrefijos: Ref[] = [];
  const referenciadas = new Set<string>();

  for (const r of registros) {
    for (const col of COLUMNAS) {
      const valor = r[col];
      if (!valor || !valor.trim()) continue;
      const n = aRuta(valor);
      if ('fuera' in n) {
        fueraDelBucket.push({ registroId: r.id, columna: col, host: n.fuera });
        continue;
      }
      referenciadas.add(n.ruta);
      const raiz = n.ruta.split('/')[0];
      if (raiz === 'temp') bajoTemp.push({ registroId: r.id, columna: col });
      else if (raiz !== 'registros') fueraDePrefijos.push({ registroId: r.id, columna: col });
      if (!existentes.has(n.ruta)) inexistentes.push({ registroId: r.id, columna: col });
    }
  }

  // Objetos sin ninguna ruta_* que los use, clasificados.
  const ahora = Date.now();
  const sobrantesTemp: { registroSesion: string }[] = [];
  const huerfanosViejos = new Set<string>();
  const huerfanosRecientes = new Set<string>();
  let huerfanosViejosObj = 0;
  let huerfanosRecientesObj = 0;
  let sinRefRegistros = 0;
  let otrosPrefijos = 0;
  for (const o of objetos) {
    if (referenciadas.has(o.ruta)) continue;
    const partes = o.ruta.split('/');
    if (partes[0] === 'temp' && partes.length >= 3 && UUID_RE.test(partes[1])) {
      const uuid = partes[1].toLowerCase();
      if (sesiones.has(uuid)) {
        sobrantesTemp.push({ registroSesion: uuid });
      } else {
        const horas = o.creado ? (ahora - new Date(o.creado).getTime()) / 3_600_000 : Infinity;
        if (horas >= HORAS_HUERFANO) {
          huerfanosViejos.add(uuid);
          huerfanosViejosObj++;
        } else {
          huerfanosRecientes.add(uuid);
          huerfanosRecientesObj++;
        }
      }
    } else if (partes[0] === 'registros') {
      sinRefRegistros++;
    } else {
      otrosPrefijos++;
    }
  }
  const registrosConSobrantes = registros
    .filter((r) => r.upload_session_id && sobrantesTemp.some((s) => s.registroSesion === r.upload_session_id!.toLowerCase()))
    .map((r) => r.id);

  // ---- Reporte
  console.log('================ FALLAS (rompen el invariante) ================');
  console.log(`ruta_* que apuntan bajo temp/: ${bajoTemp.length} en ${contarRegistros(bajoTemp)} registros`);
  for (const l of porRegistro(bajoTemp)) console.log(l);
  console.log(`\nruta_* que apuntan a un objeto que NO existe: ${inexistentes.length} en ${contarRegistros(inexistentes)} registros`);
  for (const l of porRegistro(inexistentes)) console.log(l);

  console.log('\n================ INFORMATIVO (no es falla) ================');
  const hosts = [...new Set(fueraDelBucket.map((f) => f.host))].join(', ');
  console.log(
    `ruta_* que no apuntan a este bucket: ${fueraDelBucket.length} en ${contarRegistros(fueraDelBucket)} registros` +
      (hosts ? ` (${hosts})` : ''),
  );
  for (const l of porRegistro(fueraDelBucket)) console.log(l);

  console.log('\n================ AVISOS (no son falla) ================');
  console.log(
    `Objetos en temp/ de registros que ya no los usan (sobrantes de promoción): ${sobrantesTemp.length}` +
      (registrosConSobrantes.length ? ` — registros ${registrosConSobrantes.join(', ')}` : ''),
  );
  console.log(`Objetos en registros/ sin ninguna ruta_*: ${sinRefRegistros}`);
  console.log(
    `Huérfanos en temp/ (sin registro) con ${HORAS_HUERFANO} h o más: ${huerfanosViejosObj} objetos en ${huerfanosViejos.size} carpetas`,
  );
  console.log(
    `Huérfanos en temp/ con menos de ${HORAS_HUERFANO} h (posibles inscripciones en curso): ${huerfanosRecientesObj} objetos en ${huerfanosRecientes.size} carpetas`,
  );
  console.log(`Objetos fuera de temp/ y registros/ sin ruta_*: ${otrosPrefijos}`);
  console.log(`ruta_* que apuntan fuera de temp/ y registros/: ${fueraDePrefijos.length}`);
  for (const l of porRegistro(fueraDePrefijos)) console.log(l);

  const roto = bajoTemp.length > 0 || inexistentes.length > 0;
  console.log(
    `\nRESULTADO: ${roto ? 'INVARIANTE ROTO' : 'el invariante se cumple'} ` +
      `(${bajoTemp.length} bajo temp/, ${inexistentes.length} a objetos inexistentes).`,
  );
  return roto ? 1 : 0;
}

main().then(
  (codigo) => {
    process.exitCode = codigo;
  },
  (e) => {
    console.error(`\nNO SE PUDO VERIFICAR: ${mensaje(e)}`);
    process.exitCode = 2;
  },
);
