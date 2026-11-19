// =============================================================
// Verificación del catálogo de estados y municipios (prebuild)
//
// Lee el catálogo con la MISMA función que usa /api/catalogos
// (leerCatalogo en src/lib/catalogos.ts), contra la misma base y con el
// mismo límite de filas de Supabase, y comprueba lo que recibiría el
// formulario:
//   - exactamente 32 entidades;
//   - ninguna entidad sin municipios (ni con un municipio vacío).
//
// Existe porque la ruta no paginaba desde que se creó (febrero de 2026) y
// entregaba solo las primeras 1000 filas (19 estados) sin que nada fallara:
// el corte lo hacía el servidor, no el código, y solo una lectura real lo ve.
//
// Comportamiento:
//   - Catálogo leído y no cumple   -> falla el build en todos los entornos
//                                     (la base es la misma para todos).
//   - No se pudo leer (red, tiempo, credenciales ausentes, error de
//     Supabase) tras un reintento,
//     o error inesperado del script -> también falla el build. Un aviso
//                                     que deja seguir no lo lee nadie.
//   - CATALOGO_CHECK=off           -> se omite. Es la única salida de
//                                     emergencia, y es un acto explícito.
//
// Se ejecuta con Node directamente (type stripping, Node >= 22.18), con
// .env.local si existe:
//   node --env-file-if-exists=.env.local scripts/verificar-catalogo.mts
//
// Solo lee: un SELECT paginado sobre `catalogos`.
//
// ATENCIÓN: scripts/ está excluido del type-check en tsconfig.json. Node
// solo borra los tipos, no los comprueba. Tras editar, ejecuta el script a
// mano.
// =============================================================

import { createPublicSupabaseClient } from "../src/lib/supabase-public.ts";
import { leerCatalogo } from "../src/lib/catalogos.ts";

const ENTIDADES_ESPERADAS = 32;
const TIMEOUT_MS = 5000;
const REINTENTO_DELAY_MS = 2000;

type Catalogo = Record<string, string[]>;
type Lectura = { ok: true; catalogo: Catalogo } | { ok: false; motivo: string };

const entorno = process.env.VERCEL_ENV ?? "local";

function log(linea = ""): void {
    process.stdout.write(linea + "\n");
}

function esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function intentarLeer(): Promise<Lectura> {
    try {
        const supabase = createPublicSupabaseClient({ timeoutMs: TIMEOUT_MS });
        return { ok: true, catalogo: await leerCatalogo(supabase) };
    } catch (err) {
        const e = err as { message?: string };
        return { ok: false, motivo: e.message ?? String(err) };
    }
}

async function leer(): Promise<Lectura> {
    const primero = await intentarLeer();
    if (primero.ok) return primero;
    await esperar(REINTENTO_DELAY_MS);
    const segundo = await intentarLeer();
    if (segundo.ok) return segundo;
    return {
        ok: false,
        motivo: `intento 1: ${primero.motivo}; intento 2: ${segundo.motivo}`,
    };
}

function falloSinVerificar(detalle: string): void {
    log(`✖ Catálogo de estados: no se pudo verificar.`);
    log(`  ${detalle}`);
    log(`  Build detenido. Revisa que Supabase responda y que existan las variables`);
    log(`  NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; después vuelve a desplegar.`);
    log(`  (Para saltar esta verificación en una emergencia: CATALOGO_CHECK=off)`);
    log();
}

function problemasDe(catalogo: Catalogo): string[] {
    const problemas: string[] = [];
    const estados = Object.keys(catalogo);

    if (estados.length !== ENTIDADES_ESPERADAS) {
        problemas.push(
            `trae ${estados.length} entidades y deben ser ${ENTIDADES_ESPERADAS}. ` +
                `Última en la lista: ${[...estados].sort().at(-1) ?? "ninguna"}.`,
        );
    }
    for (const estado of estados) {
        const municipios = catalogo[estado] ?? [];
        const validos = municipios.filter((m) => typeof m === "string" && m.trim() !== "");
        if (validos.length === 0) {
            problemas.push(`${estado}: sin municipios.`);
        } else if (validos.length !== municipios.length) {
            problemas.push(
                `${estado}: ${municipios.length - validos.length} municipio(s) vacíos.`,
            );
        }
    }
    return problemas;
}

async function main(): Promise<number> {
    log();
    log(`Verificación del catálogo de estados y municipios (entorno: ${entorno})`);

    if (process.env.CATALOGO_CHECK === "off") {
        log(`⚠ Omitida por CATALOGO_CHECK=off.`);
        log();
        return 0;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        falloSinVerificar(`faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.`);
        return 1;
    }

    const lectura = await leer();
    if (!lectura.ok) {
        falloSinVerificar(lectura.motivo);
        return 1;
    }

    const { catalogo } = lectura;
    const problemas = problemasDe(catalogo);
    const totalMunicipios = Object.values(catalogo).reduce((n, m) => n + m.length, 0);

    if (problemas.length === 0) {
        log(
            `  ✓ ${Object.keys(catalogo).length} entidades, ${totalMunicipios} municipios, ninguna vacía.`,
        );
        log();
        return 0;
    }

    log();
    for (const p of problemas) log(`✖ ${p}`);
    log();
    log(`Lo que el formulario recibiría de /api/catalogos está incompleto. Build detenido.`);
    log(`Revisa src/lib/catalogos.ts (paginación) y la tabla catalogos en Supabase.`);
    log(`(Para saltar esta verificación en una emergencia: CATALOGO_CHECK=off)`);
    log();
    return 1;
}

// process.exitCode en lugar de process.exit(): ver verificar-versiones-legales.mts
// (process.exit inmediato tras un fetch dispara una aserción de libuv en Windows).
main().then(
    (code) => {
        process.exitCode = code;
    },
    (err) => {
        // Error inesperado del propio script: tampoco se verificó nada.
        falloSinVerificar(`error inesperado: ${String(err)}`);
        process.exitCode = 1;
    },
);
