import { NextRequest, NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import { FILE_CONFIG } from "@/lib/constants";

const TIPOS_PERMITIDOS = ["ine", "acta_nacimiento", "comprobante_domicilio"];

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
};

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { uploadId, tipo, contentType, size } = body;

        if (
            uploadId === undefined ||
            tipo === undefined ||
            contentType === undefined ||
            size === undefined ||
            typeof uploadId !== "string" ||
            typeof tipo !== "string" ||
            typeof contentType !== "string" ||
            typeof size !== "number"
        ) {
            return NextResponse.json(
                { error: "Faltan campos requeridos o tienen tipos inválidos" },
                { status: 400 },
            );
        }

        if (!UUID_REGEX.test(uploadId)) {
            return NextResponse.json(
                { error: "Identificador de subida inválido" },
                { status: 400 },
            );
        }

        if (!TIPOS_PERMITIDOS.includes(tipo)) {
            return NextResponse.json(
                { error: "Tipo de documento no permitido" },
                { status: 400 },
            );
        }

        if (!FILE_CONFIG.allowedTypes.includes(contentType)) {
            return NextResponse.json(
                { error: "Tipo de archivo no permitido" },
                { status: 400 },
            );
        }

        if (size <= 0 || size > FILE_CONFIG.maxSize) {
            return NextResponse.json(
                { error: "El tamaño del archivo no es válido" },
                { status: 400 },
            );
        }

        const ext = CONTENT_TYPE_TO_EXT[contentType];
        const path = `temp/${uploadId}/${tipo}.${ext}`;

        const supabase = createPublicSupabaseClient();
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
