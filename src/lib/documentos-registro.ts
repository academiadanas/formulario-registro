// Documentos de una inscripción: validación de rutas, comprobación de que los
// archivos subidos existen antes del INSERT, y promoción de temp/ a
// registros/ después del INSERT.
//
// Invariante del sistema: ninguna columna ruta_* apunta bajo temp/. temp/ es
// solo para subidas en curso o abandonadas (las limpia la herramienta de
// huérfanos de Control Escolar). Se comprueba con
// scripts/verificar-invariante-documentos.mts.
//
// Solo se usa en el servidor (service role).

import { randomUUID } from 'node:crypto';
import { ACADEMIA_INFO } from '@/lib/constants';
import { createPublicSupabaseClient } from '@/lib/supabase-public';

const BUCKET = 'documentos';

export const COLUMNAS_DOCUMENTO = [
  'ruta_ine_frente',
  'ruta_ine_reverso',
  'ruta_acta_nacimiento',
  'ruta_comprobante_domicilio',
] as const;
export type ColumnaDocumento = (typeof COLUMNAS_DOCUMENTO)[number];
export type RutasDocumento = Partial<Record<ColumnaDocumento, string>>;

// Mismos nombres que ve la alumna en el formulario (NOMBRES_DOCUMENTOS en
// FormularioInscripcion.tsx).
export const ETIQUETAS_DOCUMENTO: Record<ColumnaDocumento, string> = {
  ruta_ine_frente: 'INE o CURP (frente)',
  ruta_ine_reverso: 'INE o CURP (reverso)',
  ruta_acta_nacimiento: 'Acta de Nacimiento',
  ruta_comprobante_domicilio: 'Comprobante de Domicilio',
};

// Estos errores ocurren ANTES del INSERT: la alumna no queda inscrita. Cada
// mensaje le dice que sus datos siguen ahí, qué hacer y a quién escribir si
// el reintento tampoco funciona.
export const CONTACTO_SI_PERSISTE = `Si vuelve a pasar, escríbenos por WhatsApp al ${ACADEMIA_INFO.telefono} o por correo a ${ACADEMIA_INFO.correo}.`;

export function mensajeArchivoInvalido(columna: ColumnaDocumento): string {
  return `Hubo un problema con tu archivo de ${ETIQUETAS_DOCUMENTO[columna]}. Tus demás datos siguen aquí: regresa al paso 2, vuelve a seleccionar ese documento y pulsa «Enviar registro» de nuevo. ${CONTACTO_SI_PERSISTE}`;
}

// Mismas extensiones que CONTENT_TYPE_TO_EXT en upload-url/route.ts.
const EXTENSIONES = ['pdf', 'jpg', 'png'];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * La ruta debe ser exactamente la que construye /api/registro/upload-url para
 * ESTA petición: temp/{uploadId}/{tipo}.{ext}, con el tipo de su columna. Así
 * un cliente no puede ligar archivos de otra carpeta ni cruzar documentos
 * entre columnas.
 */
export function rutaValida(ruta: unknown, uploadId: string, columna: ColumnaDocumento): ruta is string {
  if (typeof ruta !== 'string') return false;
  const tipo = columna.replace(/^ruta_/, '');
  const re = new RegExp(`^temp/${escapar(uploadId)}/${tipo}\\.(${EXTENSIONES.join('|')})$`);
  return re.test(ruta);
}

const nombreArchivo = (ruta: string) => ruta.slice(ruta.lastIndexOf('/') + 1);

// ------------------------------------------------- antes del INSERT

const TIMEOUT_VERIFICACION_MS = 8_000;

export type ResultadoVerificacion =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Comprueba que cada archivo que el registro va a referenciar exista en
 * temp/{uploadId}/ y no esté vacío. Si Storage no responde, se rechaza (sin
 * registro creado): la alumna puede volver a enviar.
 */
export async function verificarArchivosSubidos(
  uploadId: string,
  rutas: RutasDocumento,
): Promise<ResultadoVerificacion> {
  const presentes = COLUMNAS_DOCUMENTO.filter((c) => rutas[c]);
  if (presentes.length === 0) return { ok: true };

  let archivos: { name: string; metadata: Record<string, unknown> | null }[];
  try {
    const sb = createPublicSupabaseClient({ timeoutMs: TIMEOUT_VERIFICACION_MS });
    const { data, error } = await sb.storage.from(BUCKET).list(`temp/${uploadId}`, { limit: 100 });
    if (error || !data) throw error ?? new Error('respuesta sin lista');
    archivos = data;
  } catch (err) {
    console.error(`[registro] No se pudo verificar los archivos de uploadSessionId ${uploadId}:`, err);
    return {
      ok: false,
      status: 503,
      error: `No pudimos verificar tus documentos en este momento y tu registro todavía no se guardó. Tus datos siguen aquí: espera unos segundos y pulsa «Enviar registro» de nuevo. ${CONTACTO_SI_PERSISTE}`,
    };
  }

  const porNombre = new Map(archivos.map((a) => [a.name, a]));
  for (const col of presentes) {
    const archivo = porNombre.get(nombreArchivo(rutas[col] as string));
    if (!archivo) {
      return {
        ok: false,
        status: 400,
        error: `No encontramos tu archivo de ${ETIQUETAS_DOCUMENTO[col]} y tu registro todavía no se guardó. Tus datos siguen aquí: pulsa «Enviar registro» de nuevo. ${CONTACTO_SI_PERSISTE}`,
      };
    }
    const tamano = (archivo.metadata as { size?: unknown } | null)?.size;
    if (typeof tamano !== 'number' || tamano <= 0) {
      return {
        ok: false,
        status: 400,
        error: `Tu archivo de ${ETIQUETAS_DOCUMENTO[col]} llegó vacío y tu registro todavía no se guardó. Tus demás datos siguen aquí: regresa al paso 2, vuelve a seleccionar ese documento y pulsa «Enviar registro» de nuevo. ${CONTACTO_SI_PERSISTE}`,
      };
    }
  }
  return { ok: true };
}

// ------------------------------------------------ después del INSERT

const TIMEOUT_LLAMADA_MS = 5_000;
const TOPE_TOTAL_MS = 20_000;

interface Meta {
  size?: number;
  eTag?: string;
  mimetype?: string;
}

/**
 * Promueve los documentos de un registro recién creado de
 * temp/{uploadId}/{tipo}.{ext} a registros/{uuid nuevo}/{tipo}.{ext}:
 * copiar → verificar → UPDATE de ruta_* → SOLO ENTONCES borrar el original.
 *
 * Nunca lanza. Cualquier falla deja cada ruta_* apuntando a un objeto que
 * existe (el original o la copia) y se registra en UNA sola línea de log con
 * registroId y uploadSessionId. La ruta nueva nunca se escribe en el log:
 * es lo único que protege los archivos mientras el bucket sea público.
 *
 * Reglas de borrado:
 *  - un original se borra solo si el UPDATE confirmó que la fila ya apunta a
 *    la copia;
 *  - una copia se borra solo si se sabe que la fila NO la usa;
 *  - si el resultado del UPDATE es incierto (p. ej. se cortó por tiempo), se
 *    vuelve a leer la fila; si tampoco se puede, no se borra nada.
 */
export async function promoverDocumentos(
  registroId: number,
  uploadId: string,
  rutas: RutasDocumento,
): Promise<void> {
  const presentes = COLUMNAS_DOCUMENTO.filter((c) => rutas[c]);
  if (presentes.length === 0) return;

  const nuevo = randomUUID();
  const destino = (c: ColumnaDocumento) => `registros/${nuevo}/${nombreArchivo(rutas[c] as string)}`;
  const ocultar = (s: string) => s.split(nuevo).join('{nuevo}');
  const texto = (e: unknown) =>
    ocultar(e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e));

  const eventos: string[] = [];
  let enRegistros: ColumnaDocumento[] = [];
  let enTemp: ColumnaDocumento[] = [...presentes];
  let estadoConocido = true;

  try {
    const sb = createPublicSupabaseClient({
      timeoutMs: TIMEOUT_LLAMADA_MS,
      signal: AbortSignal.timeout(TOPE_TOTAL_MS),
    });
    const bucket = sb.storage.from(BUCKET);

    // 1. Copiar
    const copiadas: ColumnaDocumento[] = [];
    for (const c of presentes) {
      try {
        const { error } = await bucket.copy(rutas[c] as string, destino(c));
        if (error) throw error;
        copiadas.push(c);
      } catch (e) {
        eventos.push(`copia ${c}: ${texto(e)}`);
      }
    }

    // 2. Verificar: la copia existe con el mismo tamaño, eTag y tipo.
    const verificadas: ColumnaDocumento[] = [];
    if (copiadas.length > 0) {
      try {
        const [orig, copia] = await Promise.all([
          bucket.list(`temp/${uploadId}`, { limit: 100 }),
          bucket.list(`registros/${nuevo}`, { limit: 100 }),
        ]);
        if (orig.error || !orig.data) throw orig.error ?? new Error('listado de temp/ vacío');
        if (copia.error || !copia.data) throw copia.error ?? new Error('listado de la copia vacío');
        const metaOrig = new Map(orig.data.map((o) => [o.name, (o.metadata ?? {}) as Meta]));
        const metaCopia = new Map(copia.data.map((o) => [o.name, (o.metadata ?? {}) as Meta]));
        for (const c of copiadas) {
          const nombre = nombreArchivo(rutas[c] as string);
          const a = metaOrig.get(nombre);
          const b = metaCopia.get(nombre);
          if (!a || !b) {
            eventos.push(`verificación ${c}: ${!b ? 'la copia no aparece' : 'el original no aparece'}`);
          } else if (typeof a.size !== 'number' || a.size !== b.size) {
            eventos.push(`verificación ${c}: tamaño distinto (${a.size} / ${b.size})`);
          } else if (a.eTag && b.eTag && a.eTag !== b.eTag) {
            eventos.push(`verificación ${c}: eTag distinto`);
          } else if (a.mimetype && b.mimetype && a.mimetype !== b.mimetype) {
            eventos.push(`verificación ${c}: tipo distinto (${a.mimetype} / ${b.mimetype})`);
          } else {
            verificadas.push(c);
          }
        }
      } catch (e) {
        eventos.push(`verificación: ${texto(e)}`);
      }
    }

    // 3. UPDATE de las columnas verificadas, solo si siguen apuntando al
    //    original (nadie las cambió desde el INSERT). Debe afectar 1 fila.
    //    'incierto' = no se sabe si se aplicó (error o corte por tiempo).
    let resultadoUpdate: 'aplicado' | 'no aplicado' | 'incierto' | 'sin intento' = 'sin intento';
    if (verificadas.length > 0) {
      try {
        const cambios = Object.fromEntries(verificadas.map((c) => [c, destino(c)]));
        let q = sb.from('registros').update(cambios).eq('id', registroId);
        for (const c of verificadas) q = q.eq(c, rutas[c] as string);
        const { data, error } = await q.select('id');
        if (error) throw error;
        if (data && data.length === 1) {
          resultadoUpdate = 'aplicado';
        } else {
          resultadoUpdate = 'no aplicado';
          eventos.push(`update: afectó ${data?.length ?? 0} filas (alguna columna cambió desde el INSERT)`);
        }
      } catch (e) {
        resultadoUpdate = 'incierto';
        eventos.push(`update: ${texto(e)}`);
      }
    }

    // 3b. Si es incierto, se lee la fila con un cliente aparte (sin el tope
    //     total, que pudo ser la causa) para saber a qué apunta cada columna.
    let actualizadas: ColumnaDocumento[] = resultadoUpdate === 'aplicado' ? verificadas : [];
    let copiasSinUso: ColumnaDocumento[] = copiadas.filter((c) => !verificadas.includes(c));
    if (resultadoUpdate === 'no aplicado') copiasSinUso = [...copiasSinUso, ...verificadas];
    let reconciliado = resultadoUpdate !== 'incierto';
    if (resultadoUpdate === 'incierto') {
      try {
        const lector = createPublicSupabaseClient({ timeoutMs: TIMEOUT_LLAMADA_MS });
        const { data, error } = await lector.from('registros').select(verificadas.join(',')).eq('id', registroId).single();
        if (error || !data) throw error ?? new Error('fila no encontrada');
        const fila = data as unknown as Record<string, string | null>;
        if (verificadas.every((c) => fila[c] === destino(c))) {
          actualizadas = verificadas;
        } else if (verificadas.every((c) => fila[c] === rutas[c])) {
          copiasSinUso = [...copiasSinUso, ...verificadas];
        } else {
          eventos.push('reconciliación: la fila tiene valores inesperados; no se borra nada');
        }
        reconciliado = true;
      } catch (e) {
        eventos.push(`reconciliación: ${texto(e)}; no se borra nada`);
        estadoConocido = false;
      }
    }
    enRegistros = actualizadas;
    enTemp = presentes.filter((c) => !actualizadas.includes(c));

    // Las copias que fallaron al copiar también se intentan borrar: si la
    // copia llegó a completarse pese al error, nadie la referencia.
    const fallidas = presentes.filter((c) => !copiadas.includes(c));

    if (reconciliado) {
      // 4. Borrar originales ya reemplazados en la fila.
      if (actualizadas.length > 0) {
        try {
          const { data, error } = await bucket.remove(actualizadas.map((c) => rutas[c] as string));
          if (error) throw error;
          if ((data?.length ?? 0) !== actualizadas.length) {
            eventos.push(`borrado de originales: ${data?.length ?? 0} de ${actualizadas.length}; sobrantes en temp/`);
          }
        } catch (e) {
          eventos.push(`borrado de originales: ${texto(e)}; sobrantes en temp/`);
        }
      }

      // 5. Borrar copias que la fila no usa.
      const aBorrar = [...copiasSinUso, ...fallidas];
      if (aBorrar.length > 0) {
        try {
          const { error } = await bucket.remove(aBorrar.map(destino));
          if (error) throw error;
        } catch (e) {
          eventos.push(`borrado de copias sin uso: ${texto(e)}; sobrantes en registros/`);
        }
      }
    }
  } catch (e) {
    eventos.push(`error inesperado: ${texto(e)}`);
    estadoConocido = false;
  }

  // Una sola línea de log por promoción.
  const estado = estadoConocido
    ? `en registros/: ${enRegistros.join(', ') || 'ninguna'}; en temp/: ${enTemp.join(', ') || 'ninguna'}`
    : 'desconocido (correr scripts/verificar-invariante-documentos.mts)';
  if (eventos.length === 0 && enTemp.length === 0) {
    console.log(`[promocion] registro ${registroId} (uploadSessionId ${uploadId}): ${enRegistros.length} documento(s) promovido(s) a registros/`);
  } else {
    console.error(`[promocion] FALLA registro ${registroId} (uploadSessionId ${uploadId}): ${eventos.join(' | ')}. Estado: ${estado}`);
  }
}
