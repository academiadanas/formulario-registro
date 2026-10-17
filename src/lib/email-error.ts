// Clasificación de errores de envío de correo (Resend).
//
// Resend devuelve `{ error }` con `name` tipado (ErrorResponse del SDK). Nunca
// se reenvía su texto al cliente: el endpoint clasifica por `name` y responde
// con un mensaje propio en español; el objeto completo queda en console.error
// del endpoint para diagnóstico. Módulo sin dependencias de Next para poder
// probarlo directamente con Node.
export type EmailErrorTipo = "destinatario" | "temporal" | "otro";

// Errores cuya causa está en los datos del destinatario (dirección rechazada
// por Resend). Reintentar con la misma dirección no ayuda.
const ERRORES_DESTINATARIO: ReadonlySet<string> = new Set([
    "validation_error",
    "invalid_parameter",
    "missing_required_field",
]);

// Errores pasajeros de cuota o ritmo: reintentar más tarde sí ayuda.
const ERRORES_TEMPORALES: ReadonlySet<string> = new Set([
    "daily_quota_exceeded",
    "monthly_quota_exceeded",
    "rate_limit_exceeded",
]);

export const MENSAJES_EMAIL_ERROR: Readonly<Record<EmailErrorTipo, string>> = {
    destinatario:
        "No pudimos enviar el correo. Revisa que tu dirección esté bien escrita.",
    temporal:
        "No pudimos enviar el correo en este momento. Inténtalo más tarde.",
    otro: "No pudimos enviar el correo de confirmación. Tu registro sí quedó guardado.",
};

// Todo lo que no sea destinatario ni temporal (incluidas excepciones de red,
// donde no hay `name`) es "otro".
export function clasificarErrorCorreo(
    name: string | null | undefined,
): EmailErrorTipo {
    if (name && ERRORES_DESTINATARIO.has(name)) return "destinatario";
    if (name && ERRORES_TEMPORALES.has(name)) return "temporal";
    return "otro";
}
