// =============================================
// Estados de EE.UU. disponibles
// =============================================
export const ESTADOS_USA = [
    { value: "ARIZONA", label: "Arizona" },
    { value: "CALIFORNIA", label: "California" },
    { value: "COLORADO", label: "Colorado" },
    { value: "FLORIDA", label: "Florida" },
    { value: "GEORGIA", label: "Georgia" },
    { value: "ILLINOIS", label: "Illinois" },
    { value: "NEVADA", label: "Nevada" },
    { value: "NEW MEXICO", label: "Nuevo México" },
    { value: "NEW YORK", label: "Nueva York" },
    { value: "NORTH CAROLINA", label: "Carolina del Norte" },
    { value: "TEXAS", label: "Texas" },
    { value: "WASHINGTON", label: "Washington" },
];

// =============================================
// Configuración de archivos
// =============================================
export const FILE_CONFIG = {
    maxSize: 5 * 1024 * 1024, // 5 MB
    allowedTypes: ["application/pdf", "image/jpeg", "image/png"],
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
};

// =============================================
// Datos de la academia
// =============================================
export const ACADEMIA_INFO = {
    nombre: "Academia Danas",
    direccion: "Av. Revolución No. 190, Int. 2, Colonia Centro, Autlán de Navarro, Jalisco, C.P. 48900, México",
    codigoPostal: "48900",
    telefono: "317 132 3237",
    correo: "academia@academiadanas.com",
    website: "https://www.academiadanas.com",
    logo: "https://vynfcgvpljnvoiqrqyti.supabase.co/storage/v1/object/public/assets/logo_academiadanas_color.png",
    reglamento: "https://tinyurl.com/reglamentoad",
};

// =============================================
// Documentos legales publicados en www.academiadanas.com
// Único punto de cambio: al publicar una nueva versión de un documento,
// actualizar aquí lastUpdated (leyenda "Última actualización" del sitio)
// y sha256 (tomado de https://academiadanas.com/legal/versiones.json).
// El script scripts/verificar-versiones-legales.mts compara estos valores
// contra el sitio en cada build (ver CLAUDE.md).
// =============================================
export const DOCUMENTOS_LEGALES = {
    contrato: {
        slug: "contrato-servicios-educativos",
        lastUpdated: "2026-09-22",
        sha256: "e8eb195306a1ca537f84ace0905ce5e7ddb424770348ce4c1ef8ebc920d27980",
    },
    terminos: {
        slug: "terminos-condiciones",
        lastUpdated: "2026-09-22",
        sha256: "f13d1b090b6ea94a6219c15fd8b78a42b3aac117782421527cad6f0730418442",
    },
    avisoPrivacidad: {
        slug: "aviso-privacidad",
        lastUpdated: "2026-09-22",
        sha256: "354380fe05c5477eb7c1afc5e37ab43a3270f69c1fcd113341718a55d4c095c3",
    },
} as const;

// Fechas de versión que /api/registro estampa en cada registro.
// Derivadas de DOCUMENTOS_LEGALES: no editar aquí.
export const VERSIONES_DOCUMENTOS = {
    contrato: DOCUMENTOS_LEGALES.contrato.lastUpdated,
    terminos: DOCUMENTOS_LEGALES.terminos.lastUpdated,
    avisoPrivacidad: DOCUMENTOS_LEGALES.avisoPrivacidad.lastUpdated,
} as const;
