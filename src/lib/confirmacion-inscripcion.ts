// Datos que el formulario entrega a /inscripcion/gracias tras un INSERT
// exitoso. NUNCA viajan en la URL: `uploadId` es el nombre de la carpeta de
// los documentos de la alumna (`temp/{uploadId}/`) en un bucket público, y
// dejarlo en historial, logs o enlaces compartidos expondría su INE. El
// correo tampoco va en la URL por ser dato personal.
//
// Se guardan en memoria (sobrevive a la navegación cliente de router.push) y
// en sessionStorage (sobrevive a recargar la pestaña). Ninguna función de este
// módulo lanza: si el navegador rechaza sessionStorage, queda la copia en
// memoria y el flujo sigue.

export interface ConfirmacionInscripcion {
  registroId: number;
  uploadId: string;
  correo: string;
}

const CLAVE = 'inscripcion:confirmacion';

let enMemoria: ConfirmacionInscripcion | null = null;

function esConfirmacion(v: unknown): v is ConfirmacionInscripcion {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.registroId === 'number' &&
    typeof o.uploadId === 'string' &&
    typeof o.correo === 'string'
  );
}

export function guardarConfirmacion(datos: ConfirmacionInscripcion): void {
  enMemoria = datos;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (err) {
    console.error('No se pudo guardar la confirmación en sessionStorage:', err);
  }
}

/** Devuelve los datos solo si corresponden al folio indicado. */
export function leerConfirmacion(registroId: number): ConfirmacionInscripcion | null {
  if (enMemoria && enMemoria.registroId === registroId) return enMemoria;
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (esConfirmacion(parsed) && parsed.registroId === registroId) return parsed;
  } catch (err) {
    console.error('No se pudo leer la confirmación de sessionStorage:', err);
  }
  return null;
}
