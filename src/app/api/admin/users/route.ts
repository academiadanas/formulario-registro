import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
    try {
        // Verificar que el usuario actual es admin
        const supabaseAuth = await createServerSupabaseClient();
        const {
            data: { user },
        } = await supabaseAuth.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 },
            );
        }

        const { data: currentAdmin } = await supabaseAuth
            .from("admin_users")
            .select("rol")
            .eq("user_id", user.id)
            .single();

        if (!currentAdmin || currentAdmin.rol !== "admin") {
            return NextResponse.json(
                { error: "Sin permisos" },
                { status: 403 },
            );
        }

        // Crear usuario con Service Role Key
        const { email, password, nombre, rol } = await request.json();

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } },
        );

        // Crear en auth
        const { data: newUser, error: authError } =
            await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
            });

        if (authError) {
            return NextResponse.json(
                { error: authError.message },
                { status: 400 },
            );
        }

        // Insertar en admin_users
        const { error: insertError } = await supabaseAdmin
            .from("admin_users")
            .insert({
                user_id: newUser.user.id,
                email,
                nombre,
                rol,
                activo: true,
            });

        if (insertError) {
            // Si falla el insert, eliminar el usuario de auth
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
            return NextResponse.json(
                { error: insertError.message },
                { status: 400 },
            );
        }

        return NextResponse.json({ success: true, userId: newUser.user.id });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
