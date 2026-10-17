import { NextRequest, NextResponse } from 'next/server';
import { createPublicSupabaseClient } from '@/lib/supabase-public';
import { buildEmailHTML } from '@/lib/email-template';
import { Resend } from 'resend';
import { Registro } from '@/types';
import { ACADEMIA_INFO } from '@/lib/constants';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const registroId = parseInt(id);

    if (isNaN(registroId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Obtener registro
    const supabase = createPublicSupabaseClient();
    const { data: registro, error } = await supabase
      .from('registros')
      .select('*')
      .eq('id', registroId)
      .single();

    if (error || !registro) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Idempotencia: si el correo ya se envió para este registro, no se
    // reenvía — se responde con el mismo shape de éxito sin llamar a Resend.
    if (registro.contrato_enviado_at) {
      return NextResponse.json({
        success: true,
        registroId,
        emailSent: true,
        emailError: '',
        correoEnviado: registro.correo_electronico,
      });
    }

    // Enviar correo
    let emailSent = false;
    let emailError = '';

    if (resend && registro.correo_electronico) {
      try {
        // El SDK de Resend NO lanza en errores de API: devuelve { error }.
        // Solo se marca enviado (y se escribe contrato_enviado_at) cuando
        // Resend confirma el envío — un fallo genuino queda reintentable.
        const { error: sendError } = await resend.emails.send({
          from: `${ACADEMIA_INFO.nombre} <${ACADEMIA_INFO.correo}>`,
          to: registro.correo_electronico,
          subject: `✅ Confirmación de Inscripción - ${ACADEMIA_INFO.nombre} (Folio #${registroId})`,
          html: buildEmailHTML(registro as Registro),
        });

        if (sendError) {
          console.error('Error enviando correo:', sendError);
          emailError = sendError.message || 'Error al enviar correo';
        } else {
          emailSent = true;

          // Registrar que el correo con el contrato fue enviado
          await supabase
            .from('registros')
            .update({ contrato_enviado_at: new Date().toISOString() })
            .eq('id', registroId);
        }
      } catch (err) {
        console.error('Error enviando correo:', err);
        emailError = err instanceof Error ? err.message : 'Error al enviar correo';
      }
    } else if (!resend) {
      emailError = 'Servicio de correo no configurado';
    }

    return NextResponse.json({
      success: true,
      registroId,
      emailSent,
      emailError,
      correoEnviado: registro.correo_electronico,
    });
  } catch (error) {
    console.error('Error en API correo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al enviar correo' },
      { status: 500 }
    );
  }
}
