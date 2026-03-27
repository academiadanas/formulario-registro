import { NextRequest, NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase-public";

export async function POST(request: NextRequest) {
    try {
        const { registroId, rutas } = await request.json();

        if (!registroId || !rutas || Object.keys(rutas).length === 0) {
            return NextResponse.json({ success: true });
        }

        const supabase = createPublicSupabaseClient();
        const { error } = await supabase
            .from("registros")
            .update(rutas)
            .eq("id", registroId);

        if (error) {
            console.error("Error actualizando rutas de archivos:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error en API archivos:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
