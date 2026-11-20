/**
 * PRUEBA DE LA SUBIDA DEL FORMULARIO (URL firmada) — escribe y borra UN
 * archivo de prueba en temp/{uuid}/
 *
 * Hace exactamente lo que hace el formulario al enviar documentos:
 *   1. POST {base}/api/registro/upload-url con { uploadId, tipo, contentType,
 *      size }. El servidor del formulario crea la URL firmada con la llave de
 *      servicio (src/app/api/registro/upload-url/route.ts).
 *   2. Con la llave ANÓNIMA: uploadToSignedUrl(path, token, File,
 *      { contentType, upsert: true }), igual que src/lib/upload-file.ts. En
 *      Node el archivo también es un File, así que storage-js toma la misma
 *      rama que en el navegador (multipart).
 * Después, con la llave de servicio (esto ya no es el formulario, es la prueba):
 *   3. comprueba que el archivo existe en temp/{uploadId}/ con el tamaño subido;
 *   4. lo borra y comprueba que ya no existe. Se intenta siempre, aunque algo
 *      anterior haya fallado.
 *
 * Para qué: saber si la política "Permitir subida pública de documentos"
 * (anon INSERT sobre storage.objects) hace falta. Correrlo ANTES de quitarla
 * (debe salir 0: demuestra que la prueba en sí funciona) y otra vez DESPUÉS.
 *
 * Códigos de salida:
 *   0  la subida funcionó y el archivo de prueba se borró
 *   1  BLOQUEO DE POLÍTICA: Storage respondió 403 "new row violates
 *      row-level security policy" (error 42501 de Postgres)
 *   2  otra falla (servidor del formulario, red, token, tipo de archivo...):
 *      NO dice nada sobre la política
 *   3  la subida funcionó pero no se pudo borrar el archivo de prueba
 *      (borrarlo a mano: la carpeta temp/{uploadId}/ que se imprime)
 *
 * Uso (desde la raíz del repo, Node >= 22.18):
 *   node --env-file=.env.local scripts/probar-subida-firmada.mts
 *   node --env-file=.env.local scripts/probar-subida-firmada.mts --base http://localhost:3000
 *
 * Por omisión pide la URL firmada al formulario en producción
 * (https://inscripcion.academiadanas.com). Imprime el uploadId de la prueba,
 * que no es de ninguna alumna, para poder borrarla a mano si hiciera falta.
 * Nunca imprime el token ni la URL firmada.
 */

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { BUCKET, cliente, mensaje, supabaseUrl } from './lib/documentos.mts';

const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return (i > -1 && process.argv[i + 1] ? process.argv[i + 1] : 'https://inscripcion.academiadanas.com').replace(/\/+$/, '');
})();
const TIPO = 'comprobante_domicilio';
const CONTENT_TYPE = 'application/pdf';
const NOMBRE = `${TIPO}.pdf`;
const CONTENIDO = new TextEncoder().encode(
  '%PDF-1.4\n% Archivo de prueba de scripts/probar-subida-firmada.mts. Se puede borrar.\n%%EOF\n',
);

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (!supabaseUrl() || !ANON || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY (usar --env-file=.env.local).',
  );
  process.exit(2);
}

const uploadId = randomUUID();
const carpeta = `temp/${uploadId}`;
const ruta = `${carpeta}/${NOMBRE}`;
const servicio = cliente();

console.log(`Proyecto Supabase: ${supabaseUrl()}`);
console.log(`Formulario:        ${BASE}`);
console.log(`Prueba:            ${carpeta}/ (archivo de prueba, ${CONTENIDO.byteLength} bytes)\n`);

let codigo = 0;
let motivo = '';

function paso(ok: boolean, n: number, titulo: string, detalle: string) {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${n}. ${titulo}`);
  console.log(`      ${detalle}`);
}

async function existe(): Promise<{ esta: boolean; tamano: number | null }> {
  const { data, error } = await servicio.storage.from(BUCKET).list(carpeta, { limit: 100 });
  if (error) throw error;
  const o = (data ?? []).find((x) => x.name === NOMBRE);
  return { esta: Boolean(o), tamano: (o?.metadata as { size?: number } | null)?.size ?? null };
}

try {
  // 1. Pedir la URL firmada al servidor del formulario
  let token = '';
  {
    let res: Response | null = null;
    let fallaRed = '';
    try {
      res = await fetch(`${BASE}/api/registro/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, tipo: TIPO, contentType: CONTENT_TYPE, size: CONTENIDO.byteLength }),
      });
    } catch (e) {
      fallaRed = mensaje(e);
    }
    const body = res ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
    const hostFirmado = (() => {
      try {
        return typeof body?.signedUrl === 'string' ? new URL(body.signedUrl).host : '';
      } catch {
        return '';
      }
    })();

    if (!res) {
      motivo = `sin conexión con el formulario (${fallaRed})`;
    } else if (!res.ok || typeof body?.token !== 'string' || typeof body?.path !== 'string') {
      motivo = `el formulario respondió HTTP ${res.status}: ${String(body?.error ?? 'sin token en la respuesta')}`;
    } else if (body.path !== ruta) {
      motivo = 'el formulario devolvió una ruta distinta a temp/{uploadId}/comprobante_domicilio.pdf';
    } else if (hostFirmado !== new URL(supabaseUrl()).host) {
      motivo = `la URL firmada es de otro proyecto (${hostFirmado || 'desconocido'}) que el de .env.local`;
    } else {
      token = body.token;
    }
    paso(Boolean(token), 1, 'URL firmada pedida al servidor del formulario', token ? `HTTP ${res?.status}, ruta temp/{uploadId}/${NOMBRE}` : motivo);
    if (!token) codigo = 2;
  }

  // 2. Subir con la llave anónima, como el navegador de la alumna
  if (codigo === 0) {
    const anon = createClient(supabaseUrl(), ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const archivo = new File([CONTENIDO], NOMBRE, { type: CONTENT_TYPE });
    const { error } = await anon.storage
      .from(BUCKET)
      .uploadToSignedUrl(ruta, token, archivo, { contentType: CONTENT_TYPE, upsert: true });
    if (!error) {
      paso(true, 2, 'Subida con la llave anónima (uploadToSignedUrl)', 'Storage aceptó el archivo');
    } else {
      const e = error as { message?: string; status?: number; statusCode?: string };
      const texto = `HTTP ${e.status ?? '?'} · statusCode ${e.statusCode ?? '?'} · ${mensaje(error)}`;
      if (/row-level security/i.test(e.message ?? '')) {
        codigo = 1;
        motivo = 'BLOQUEO DE POLÍTICA';
        paso(false, 2, 'Subida con la llave anónima (uploadToSignedUrl)', `${texto}\n      → es la política: la subida firmada SÍ la necesita.`);
      } else {
        codigo = 2;
        motivo = 'la subida falló por otra causa';
        paso(false, 2, 'Subida con la llave anónima (uploadToSignedUrl)', `${texto}\n      → no es el mensaje de una política: esto no dice nada sobre ella.`);
      }
    }
  }

  // 3. El archivo existe con el tamaño subido
  if (codigo === 0) {
    const { esta, tamano } = await existe();
    const ok = esta && tamano === CONTENIDO.byteLength;
    paso(ok, 3, 'El archivo quedó en temp/{uploadId}/', esta ? `${tamano} bytes` : 'no aparece en el bucket');
    if (!ok) {
      codigo = 2;
      motivo = 'Storage aceptó la subida pero el archivo no está como se esperaba';
    }
  }
} catch (e) {
  codigo = codigo || 2;
  motivo = motivo || `error inesperado: ${mensaje(e)}`;
  console.log(`FALLA error inesperado: ${mensaje(e)}`);
}

// 4. Limpieza, siempre (si no se subió nada, solo confirma que no hay nada)
try {
  const antes = await existe();
  if (antes.esta) {
    const { error } = await servicio.storage.from(BUCKET).remove([ruta]);
    if (error) throw error;
  }
  const despues = await existe();
  if (despues.esta) throw new Error('el archivo sigue existiendo después de borrarlo');
  paso(true, 4, 'Limpieza con la llave de servicio', antes.esta ? 'archivo de prueba borrado; ya no existe' : 'no había nada que borrar');
} catch (e) {
  paso(false, 4, 'Limpieza con la llave de servicio', `${mensaje(e)}\n      → borrar a mano la carpeta ${carpeta}/ del bucket ${BUCKET}`);
  if (codigo === 0) codigo = 3;
}

console.log('');
if (codigo === 0) {
  console.log('RESULTADO: la subida del formulario funciona. Si la política ya no existe, estaba de más.');
} else if (codigo === 1) {
  console.log('RESULTADO: BLOQUEO DE POLÍTICA. La subida firmada necesita la política: vuelve a crearla.');
} else if (codigo === 2) {
  console.log(`RESULTADO: NO CONCLUYENTE (${motivo}). Esta falla no es la de una política.`);
} else {
  console.log(`RESULTADO: la subida funciona, pero quedó el archivo de prueba en ${carpeta}/.`);
}
process.exit(codigo);
