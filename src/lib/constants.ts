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
