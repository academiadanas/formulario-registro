import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import { CursoOption } from "@/types";

// Deriva el label que ve la alumna a partir del tipo de programa.
// Fallback defensivo: si el tipo es desconocido o null, usa el nombre solo.
function derivarLabel(tipo: string | null, nombreProducto: string): string {
    switch (tipo) {
        case "Diplomado":
            return `Diplomado en ${nombreProducto}`;
        case "Curso":
            return `Curso de ${nombreProducto}`;
        case "Taller":
            return `Taller de ${nombreProducto}`;
        default:
            return nombreProducto;
    }
}

export async function GET() {
    try {
        const supabase = createPublicSupabaseClient();

        const { data, error } = await supabase
            .from("programas")
            .select(
                "codigo, nombre_producto, tipo, grupo, requiere_documentos, orden",
            )
            .eq("visible_en_formulario", true)
            .eq("activo", true)
            .order("orden", { ascending: true });

        if (error) {
            console.error("Error fetching programas:", error);
            return NextResponse.json(
                { error: "Error al obtener programas" },
                { status: 500 },
            );
        }

        const cursos: CursoOption[] = data.map((row) => ({
            value: row.codigo,
            label: derivarLabel(row.tipo, row.nombre_producto),
            grupo: row.grupo,
            requiereDocumentos: row.requiere_documentos,
        }));

        return NextResponse.json(cursos);
    } catch (error) {
        console.error("Error en API programas:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 },
        );
    }
}
