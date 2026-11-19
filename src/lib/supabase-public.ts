import { createClient } from '@supabase/supabase-js';

interface OpcionesCliente {
  /** Tiempo límite de cada petición, en milisegundos. */
  timeoutMs?: number;
  /** Señal que aborta todas las peticiones del cliente (tope total). */
  signal?: AbortSignal;
}

// Sin opciones, el cliente es el mismo de siempre (sin límites de tiempo).
export function createPublicSupabaseClient(opciones: OpcionesCliente = {}) {
  const { timeoutMs, signal } = opciones;
  const conLimite = timeoutMs !== undefined || signal !== undefined;

  const fetchConLimite: typeof fetch = (input, init) => {
    const senales = [
      init?.signal,
      timeoutMs !== undefined ? AbortSignal.timeout(timeoutMs) : undefined,
      signal,
    ].filter((s): s is AbortSignal => s !== undefined && s !== null);
    return fetch(input, { ...init, signal: AbortSignal.any(senales) });
  };

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    conLimite ? { global: { fetch: fetchConLimite } } : undefined
  );
}
