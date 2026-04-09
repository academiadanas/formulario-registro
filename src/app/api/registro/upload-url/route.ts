import { NextRequest, NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import { FILE_CONFIG } from "@/lib/constants";

const TIPOS_PERMITIDOS = ["ine", "acta_nacimiento", "comprobante_domicilio"];

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { registroId, tipo, contentType, size } = body;

        // Validar campos presentes y tipos
        if (
            registroId === undefined ||
            tipo === undefined ||
            contentType === undefined ||
            size === undefined ||
            typeof registroId !== "number" ||
            typeof tipo !== "string" ||
            typeof contentType !== "string" ||
            typeof size !== "number"
        ) {
            return NextResponse.json(
                { error: "Faltan campos requeridos o tienen tipos inválidos" },
                { status: 400 },
            );
        }

        // Validar tipo permitido
        if (!TIPOS_PERMITIDOS.includes(tipo)) {
            return NextResponse.json(
                { error: "Tipo de documento no permitido" },
                { status: 400 },
            );
        }

        // Validar content-type permitido
        if (!FILE_CONFIG.allowedTypes.includes(contentType)) {
            return NextResponse.json(
                { error: "Tipo de archivo no permitido" },
                { status: 400 },
            );
        }

        // Validar tamaño
        if (size <= 0 || size > FILE_CONFIG.maxSize) {
            return NextResponse.json(
                { error: "El tamaño del archivo no es válido" },
                { status: 400 },
            );
        }

        // Verificar que el registro existe y es reciente
        const supabase = createPublicSupabaseClient();

        const { data: registro, error: selectError } = await supabase
            .from("registros")
            .select("id, fecha_registro")
            .eq("id", registroId)
            .single();

        if (selectError || !registro) {
            return NextResponse.json(
                { error: "Registro no encontrado" },
                { status: 404 },
            );
        }

        const fechaRegistro = new Date(registro.fecha_registro);
        const ahora = new Date();
        const diffMs = ahora.getTime() - fechaRegistro.getTime();
        const quinceMins = 15 * 60 * 1000;

        if (diffMs > quinceMins) {
            return NextResponse.json(
                { error: "El registro ha expirado para subida de archivos" },
                { status: 403 },
            );
        }

        // Construir path del archivo
        const ext = CONTENT_TYPE_TO_EXT[contentType];
        const path = `${registroId}/${tipo}_${registroId}.${ext}`;

        // Crear signed upload URL
        const { data, error: uploadError } = await supabase.storage
            .from("documentos")
            .createSignedUploadUrl(path);

        if (uploadError || !data) {
            console.error("[upload-url] Error creando signed URL:", uploadError);
            return NextResponse.json(
                { error: "Error al generar la URL de subida" },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            signedUrl: data.signedUrl,
            token: data.token,
            path: data.path,
        });
    } catch (error) {
        console.error("[upload-url] Error inesperado:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 },
        );
    }
}
