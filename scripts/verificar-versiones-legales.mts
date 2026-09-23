// =============================================================
// Verificación de versiones de documentos legales (prebuild)
//
// Compara DOCUMENTOS_LEGALES (src/lib/constants.ts) contra el JSON que
// publica el sitio web: https://academiadanas.com/legal/versiones.json
//
// Comportamiento:
//   - JSON inaccesible o inválido  -> aviso, el build continúa.
//   - Discrepancia de fecha o hash -> falla en producción (VERCEL_ENV=production),
//                                     aviso en previews y en local.
//   - Documento en el JSON que no conocemos -> aviso siempre.
//   - LEGAL_VERSIONS_CHECK=off     -> se omite la verificación.
//
// Se ejecuta con Node directamente (type stripping, Node >= 22.18):
//   node scripts/verificar-versiones-legales.mts
//
// ATENCIÓN: scripts/ está excluido del type-check en tsconfig.json (Next
// no acepta el import con extensión .ts que Node exige). Node solo borra
// los tipos, no los comprueba: aquí no hay red de seguridad. Tras editar,
// ejecuta el script a mano y revisa que los tipos sigan cuadrando.
// =============================================================

import { DOCUMENTOS_LEGALES } from "../src/lib/constants.ts";

const URL_VERSIONES = "https://academiadanas.com/legal/versiones.json";
const TIMEOUT_MS = 5000;
const REINTENTO_DELAY_MS = 2000;
const SCHEMA_VERSION_ESPERADO = 1;
const RUTA_CONSTANTES = "src/lib/constants.ts";

type DocumentoSitio = { lastUpdated?: unknown; sha256?: unknown };

type VersionesJson = {
    schemaVersion?: unknown;
    generatedAt?: unknown;
    commit?: unknown;
    hash?: { algorithm?: unknown; source?: unknown };
    documents?: Record<string, DocumentoSitio>;
};

type ResultadoFetch =
    | { ok: true; json: VersionesJson }
    | { ok: false; motivo: string };

const esProduccion = process.env.VERCEL_ENV === "production";
const entorno = process.env.VERCEL_ENV ?? "local";

function log(linea = ""): void {
    process.stdout.write(linea + "\n");
}

function esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function intentarFetch(): Promise<ResultadoFetch> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const url = `${URL_VERSIONES}?t=${Date.now()}`;
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { "Cache-Control": "no-cache", Accept: "application/json" },
        });
        if (!res.ok) {
            return { ok: false, motivo: `HTTP ${res.status} ${res.statusText}` };
        }
        const json = (await res.json()) as VersionesJson;
        return { ok: true, json };
    } catch (err) {
        const e = err as { name?: string; message?: string };
        const motivo =
            e.name === "AbortError"
                ? `timeout de ${TIMEOUT_MS / 1000}s`
                : (e.message ?? String(err));
        return { ok: false, motivo };
    } finally {
        clearTimeout(timer);
    }
}

async function obtenerVersiones(): Promise<ResultadoFetch> {
    const primero = await intentarFetch();
    if (primero.ok) return primero;
    await esperar(REINTENTO_DELAY_MS);
    const segundo = await intentarFetch();
    if (segundo.ok) return segundo;
    return {
        ok: false,
        motivo: `intento 1: ${primero.motivo}; intento 2: ${segundo.motivo}`,
    };
}

function avisoSinValidar(detalle: string): void {
    log(`⚠ Versiones legales: no se pudo validar contra ${URL_VERSIONES}`);
    log(`  ${detalle}`);
    log(`  El build continúa sin validar. Si esto se repite en producción,`);
    log(`  revisa que el sitio esté arriba y vuelve a desplegar para validar.`);
    log();
}

function corto(hash: string): string {
    return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

type Problema = { slug: string; lineas: string[] };

function compararDocumento(
    clave: string,
    local: { slug: string; lastUpdated: string; sha256: string },
    sitio: DocumentoSitio | undefined,
    commitSitio: string,
): Problema | null {
    const { slug } = local;

    if (!sitio) {
        return {
            slug,
            lineas: [
                `no aparece en versiones.json del sitio.`,
                `Qué hacer: revisa que el slug "${slug}" en ${RUTA_CONSTANTES}`,
                `coincida con la URL publicada, o que el sitio no haya renombrado la página.`,
            ],
        };
    }

    const fechaSitio =
        typeof sitio.lastUpdated === "string" ? sitio.lastUpdated : "";
    const hashSitio = typeof sitio.sha256 === "string" ? sitio.sha256 : "";

    if (!fechaSitio || !hashSitio) {
        return {
            slug,
            lineas: [
                `la entrada del sitio no trae lastUpdated o sha256 válidos.`,
                `Qué hacer: revisa la generación de versiones.json en el repo del sitio web.`,
            ],
        };
    }

    const mismaFecha = fechaSitio === local.lastUpdated;
    const mismoHash = hashSitio === local.sha256;

    if (mismaFecha && mismoHash) return null;

    // Caso A: el sitio va adelante.
    if (fechaSitio > local.lastUpdated) {
        return {
            slug,
            lineas: [
                `versión desactualizada en este repo.`,
                `Repo:  ${local.lastUpdated}  (sha256 ${corto(local.sha256)})`,
                `Sitio: ${fechaSitio}  (sha256 ${corto(hashSitio)})  publicado en commit ${commitSitio} del sitio`,
                `Qué hacer: el sitio ya publicó una versión nueva. Actualiza la entrada`,
                `"${clave}" en ${RUTA_CONSTANTES} con estos valores:`,
                `    lastUpdated: "${fechaSitio}",`,
                `    sha256: "${hashSitio}",`,
                `y vuelve a desplegar.`,
            ],
        };
    }

    // Caso B: el repo va adelante.
    if (fechaSitio < local.lastUpdated) {
        return {
            slug,
            lineas: [
                `el sitio aún no publica esta versión.`,
                `Repo:  ${local.lastUpdated}`,
                `Sitio: ${fechaSitio}`,
                `Qué hacer: despliega primero el repo del sitio web con la nueva leyenda`,
                `"Última actualización" y el texto nuevo. Cuando ${URL_VERSIONES}`,
                `muestre ${local.lastUpdated}, vuelve a desplegar este proyecto`,
                `(Redeploy en Vercel, no hace falta commit).`,
            ],
        };
    }

    // Caso C: misma fecha, hash distinto.
    return {
        slug,
        lineas: [
            `el texto cambió sin subir versión.`,
            `Fecha en ambos lados: ${local.lastUpdated}`,
            `sha256 repo:  ${corto(local.sha256)}`,
            `sha256 sitio: ${corto(hashSitio)}  (commit ${commitSitio} del sitio)`,
            `Significa que alguien editó el texto del documento en el sitio sin`,
            `cambiar la leyenda "Última actualización". Las alumnas registradas desde`,
            `el ${local.lastUpdated} quedaron selladas con una fecha que ahora apunta`,
            `a dos textos distintos.`,
            `Qué hacer, según el tipo de cambio:`,
            ` - Cambio de fondo (cláusulas, obligaciones, datos tratados): publica una`,
            `   versión nueva. En el sitio, sube la fecha de "Última actualización";`,
            `   después actualiza lastUpdated y sha256 en la entrada "${clave}" de`,
            `   ${RUTA_CONSTANTES}.`,
            ` - Corrección menor (ortografía, formato) que no altera el sentido: copia`,
            `   el nuevo hash en ${RUTA_CONSTANTES}:`,
            `       sha256: "${hashSitio}",`,
            `   y deja la fecha como está.`,
        ],
    };
}

async function main(): Promise<number> {
    log();
    log(`Validación de versiones legales (entorno: ${entorno})`);

    if (process.env.LEGAL_VERSIONS_CHECK === "off") {
        log(`⚠ Omitida por LEGAL_VERSIONS_CHECK=off.`);
        log();
        return 0;
    }

    const resultado = await obtenerVersiones();
    if (!resultado.ok) {
        avisoSinValidar(resultado.motivo);
        return 0;
    }

    const { json } = resultado;

    if (json.schemaVersion !== SCHEMA_VERSION_ESPERADO) {
        avisoSinValidar(
            `schemaVersion ${String(json.schemaVersion)} no reconocido (este script entiende ${SCHEMA_VERSION_ESPERADO}). ` +
                `Actualiza scripts/verificar-versiones-legales.mts al nuevo formato.`,
        );
        return 0;
    }
    if (json.hash?.algorithm !== "sha256") {
        avisoSinValidar(
            `hash.algorithm es ${String(json.hash?.algorithm)}, se esperaba sha256.`,
        );
        return 0;
    }
    if (!json.documents || typeof json.documents !== "object") {
        avisoSinValidar(`el JSON no trae el objeto "documents".`);
        return 0;
    }

    const commitSitio =
        typeof json.commit === "string" ? json.commit.slice(0, 7) : "desconocido";
    log(
        `  Sitio: generado ${String(json.generatedAt ?? "?")}, commit ${commitSitio}`,
    );

    const problemas: Problema[] = [];
    const slugsConocidos = new Set<string>();

    for (const [clave, local] of Object.entries(DOCUMENTOS_LEGALES)) {
        slugsConocidos.add(local.slug);
        const problema = compararDocumento(
            clave,
            local,
            json.documents[local.slug],
            commitSitio,
        );
        if (problema) problemas.push(problema);
        else log(`  ✓ ${local.slug}: ${local.lastUpdated}`);
    }

    // Documentos que el sitio publica y este repo no conoce: aviso, nunca fallo.
    const desconocidos = Object.keys(json.documents).filter(
        (slug) => !slugsConocidos.has(slug),
    );
    for (const slug of desconocidos) {
        const doc = json.documents[slug];
        log(`  ⚠ ${slug}: el sitio publica este documento y no está en DOCUMENTOS_LEGALES.`);
        log(
            `    Sitio: ${String(doc?.lastUpdated ?? "?")} (sha256 ${corto(String(doc?.sha256 ?? ""))})`,
        );
        log(`    Qué hacer: si las alumnas deben aceptarlo al inscribirse, agrégalo a`);
        log(`    ${RUTA_CONSTANTES} y al paso 1 del formulario. Si no, ignora este aviso.`);
    }

    log();
    for (const p of problemas) {
        const [primera, ...resto] = p.lineas;
        log(`✖ ${p.slug}: ${primera}`);
        for (const l of resto) log(`  ${l}`);
        log();
    }

    const total = Object.keys(DOCUMENTOS_LEGALES).length;
    if (problemas.length === 0) {
        log(`Validación de versiones legales: ${total} documentos, sin discrepancias.`);
        log();
        return 0;
    }

    if (esProduccion) {
        log(
            `Validación de versiones legales: ${total} documentos, ${problemas.length} discrepancia(s). Build detenido.`,
        );
        log(`(Para saltar esta verificación en una emergencia: LEGAL_VERSIONS_CHECK=off)`);
        log();
        return 1;
    }

    log(
        `Validación de versiones legales: ${total} documentos, ${problemas.length} discrepancia(s). Build continúa (${entorno}).`,
    );
    log();
    return 0;
}

// Se usa process.exitCode en lugar de process.exit(): así el proceso termina
// cuando la conexión del fetch se cierra sola (process.exit inmediato tras un
// fetch dispara una aserción de libuv en Node para Windows).
main().then(
    (code) => {
        process.exitCode = code;
    },
    (err) => {
        // Error inesperado del propio script: no bloquear el build.
        avisoSinValidar(`error inesperado: ${String(err)}`);
        process.exitCode = 0;
    },
);
