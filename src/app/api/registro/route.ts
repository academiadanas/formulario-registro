import { NextRequest, NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase-public";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Función para convertir MAYÚSCULAS a Formato Título
function toTitleCase(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function rutaValida(ruta: unknown, uploadId: string): ruta is string {
    return (
        typeof ruta === "string" &&
        ruta.length > 0 &&
        ruta.startsWith(`temp/${uploadId}/`) &&
        !ruta.includes("..")
    );
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createPublicSupabaseClient();
        const body = await request.json();

        // === Validaciones server-side de uploadId y rutas ===
        const { uploadId, rutas } = body;

        if (typeof uploadId !== "string" || !UUID_REGEX.test(uploadId)) {
            return NextResponse.json(
                { error: "Identificador de subida inválido o ausente" },
                { status: 400 },
            );
        }

        if (
            rutas === null ||
            rutas === undefined ||
            typeof rutas !== "object" ||
            Array.isArray(rutas)
        ) {
            return NextResponse.json(
                { error: "Faltan las rutas de los documentos" },
                { status: 400 },
            );
        }

        const rutaIne = (rutas as Record<string, unknown>).ruta_ine;
        const rutaActa = (rutas as Record<string, unknown>).ruta_acta_nacimiento;
        const rutaComprobante = (rutas as Record<string, unknown>)
            .ruta_comprobante_domicilio;

        if (!rutaValida(rutaIne, uploadId)) {
            return NextResponse.json(
                { error: "La ruta de la INE es obligatoria o no es válida" },
                { status: 400 },
            );
        }

        if (!rutaValida(rutaComprobante, uploadId)) {
            return NextResponse.json(
                {
                    error:
                        "La ruta del comprobante de domicilio es obligatoria o no es válida",
                },
                { status: 400 },
            );
        }

        if (rutaActa !== undefined && rutaActa !== null) {
            if (!rutaValida(rutaActa, uploadId)) {
                return NextResponse.json(
                    { error: "La ruta del acta de nacimiento no es válida" },
                    { status: 400 },
                );
            }
        }

        // Extraer datos del formulario
        const registroData: Record<string, string> = {};
        const campos = [
            "nombre",
            "apellido_paterno",
            "apellido_materno",
            "telefono_celular",
            "correo_electronico",
            "estado_civil",
            "grado_estudios",
            "fecha_nacimiento",
            "pais_nacimiento",
            "estado_nacimiento",
            "municipio_nacimiento",
            "lugar_nacimiento",
            "calle_domicilio",
            "numero_exterior",
            "numero_interior",
            "colonia_domicilio",
            "codigo_postal",
            "pais_domicilio",
            "estado_domicilio",
            "municipio_domicilio",
            "familiar_nombre",
            "familiar_parentesco",
            "familiar_telefono",
            "familiar_calle",
            "familiar_numero",
            "familiar_colonia",
            "familiar_codigo_postal",
            "familiar_pais",
            "familiar_estado",
            "familiar_municipio",
            "emergencia_nombre",
            "emergencia_parentesco",
            "emergencia_telefono",
            "curso",
        ];

        for (const campo of campos) {
            const valor = body[campo];
            if (valor !== undefined && typeof valor === "string") {
                registroData[campo] = valor.trim();
            }
        }

        // Convertir a mayúsculas los campos de texto (excepto correo)
        const camposTexto = campos.filter(
            (c) =>
                ![
                    "correo_electronico",
                    "telefono_celular",
                    "fecha_nacimiento",
                    "numero_exterior",
                    "numero_interior",
                    "codigo_postal",
                    "familiar_telefono",
                    "familiar_numero",
                    "familiar_codigo_postal",
                    "emergencia_telefono",
                ].includes(c),
        );

        for (const campo of camposTexto) {
            if (registroData[campo]) {
                registroData[campo] = registroData[campo].toUpperCase();
            }
        }

        // Correo siempre en minúsculas
        if (registroData.correo_electronico) {
            registroData.correo_electronico =
                registroData.correo_electronico.toLowerCase();
        }

        // Construir payload del INSERT con rutas y upload_session_id
        const insertPayload: Record<string, string | null> = {
            ...registroData,
            ruta_ine: rutaIne,
            ruta_acta_nacimiento: rutaValida(rutaActa, uploadId) ? rutaActa : null,
            ruta_comprobante_domicilio: rutaComprobante,
            upload_session_id: uploadId,
        };

        // Insertar registro
        const { data: registro, error: insertError } = await supabase
            .from("registros")
            .insert(insertPayload)
            .select("id")
            .single();

        if (insertError) {
            console.error("Error insertando registro:", insertError);
            return NextResponse.json(
                {
                    error:
                        "Error al guardar el registro: " + insertError.message,
                },
                { status: 500 },
            );
        }

        const registroId = registro.id;

        // === INSERT O UPDATE AUTOMÁTICO EN ALUMNAS ===
        try {
            // Determinar procedencia según país de domicilio
            let procedencia = '';
            const paisDom = registroData.pais_domicilio || '';

            if (paisDom === 'MEXICO') {
                procedencia = registroData.municipio_domicilio || '';
            } else if (paisDom === 'ESTADOS UNIDOS') {
                procedencia = registroData.estado_domicilio || '';
            } else {
                // Otro país: usa estado_domicilio (que contiene estado/provincia)
                procedencia = registroData.estado_domicilio || '';
            }

            const nombreCompleto = `${registroData.nombre || ''} ${registroData.apellido_paterno || ''} ${registroData.apellido_materno || ''}`.trim();

            // Buscar si ya existe una alumna con ese correo
            const emailBusqueda = registroData.correo_electronico;
            const { data: alumnaExistente } = await supabase
                .from('alumnas')
                .select('id')
                .eq('email', emailBusqueda)
                .maybeSingle();

            if (alumnaExistente) {
                // Actualizar datos de la alumna existente (NO actualizar sexo)
                const alumnaUpdate = {
                    nombre_completo: toTitleCase(nombreCompleto),
                    celular: registroData.telefono_celular || null,
                    fecha_nacimiento: registroData.fecha_nacimiento || null,
                    estado_civil: toTitleCase(registroData.estado_civil || ''),
                    nivel_estudios: toTitleCase(registroData.grado_estudios || ''),
                    procedencia: toTitleCase(procedencia),
                    nombre_emergencia_1: toTitleCase(registroData.familiar_nombre || ''),
                    tel_emergencia_1: registroData.familiar_telefono || null,
                    nombre_emergencia_2: toTitleCase(registroData.emergencia_nombre || ''),
                    tel_emergencia_2: registroData.emergencia_telefono || null,
                };

                const { error: updateAlumnaError } = await supabase
                    .from('alumnas')
                    .update(alumnaUpdate)
                    .eq('id', alumnaExistente.id);

                if (updateAlumnaError) {
                    console.error('Error actualizando alumna existente:', updateAlumnaError);
                }
            } else {
                // Insertar nueva alumna
                const alumnaInsert = {
                    nombre_completo: toTitleCase(nombreCompleto),
                    celular: registroData.telefono_celular || null,
                    email: emailBusqueda || null,
                    fecha_nacimiento: registroData.fecha_nacimiento || null,
                    estado_civil: toTitleCase(registroData.estado_civil || ''),
                    nivel_estudios: toTitleCase(registroData.grado_estudios || ''),
                    procedencia: toTitleCase(procedencia),
                    nombre_emergencia_1: toTitleCase(registroData.familiar_nombre || ''),
                    tel_emergencia_1: registroData.familiar_telefono || null,
                    nombre_emergencia_2: toTitleCase(registroData.emergencia_nombre || ''),
                    tel_emergencia_2: registroData.emergencia_telefono || null,
                };

                const { error: insertAlumnaError } = await supabase
                    .from('alumnas')
                    .insert(alumnaInsert);

                if (insertAlumnaError) {
                    console.error('Error insertando en alumnas:', insertAlumnaError);
                }
            }
        } catch (alumnaErr) {
            console.error('Error en inserción/actualización automática a alumnas:', alumnaErr);
        }
        // === FIN INSERT/UPDATE ALUMNAS ===

        return NextResponse.json({
            success: true,
            registroId,
        });
    } catch (error) {
        console.error("Error en API registro:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 },
        );
    }
}
