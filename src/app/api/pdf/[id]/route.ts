import { NextRequest, NextResponse } from 'next/server';
import { createPublicSupabaseClient } from '@/lib/supabase-public';
import { buildEmailHTML } from '@/lib/email-template';
import { Resend } from 'resend';
import { Registro } from '@/types';
import { ACADEMIA_INFO } from '@/lib/constants';
import {
  clasificarErrorCorreo,
  MENSAJES_EMAIL_ERROR,
  type EmailErrorTipo,
} from '@/lib/email-error';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Envía el correo de confirmación de inscripción. Solo responde si el folio
// Y el upload_session_id del registro coinciden: el folio es consecutivo,
// pero el uploadId (UUID generado en el navegador de la alumna) solo lo tiene
// la pestaña donde se inscribió. Sin esa llave, cualquiera podía recorrer
// folios para obtener correos, mandar correos a alumnas antiguas y escribir
// contrato_enviado_at con una fecha falsa. Registros sin upload_session_id
// (históricos) quedan fuera a propósito.
// La respuesta NO incluye la dirección de correo: la pantalla de gracias la
// muestra desde lo que la alumna escribió (src/lib/confirmacion-inscripcion.ts).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const registroId = Number(id);

    if (!Number.isInteger(registroId) || registroId <= 0) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }

    let uploadSessionId: unknown;
    try {
      ({ uploadSessionId } = await request.json());
    } catch {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }

    if (typeof uploadSessionId !== 'string' || !UUID_REGEX.test(uploadSessionId)) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }

    // Folio y llave en la misma consulta: si no coinciden, la respuesta es
    // idéntica a la de un folio inexistente.
    const supabase = createPublicSupabaseClient();
    const { data: registro, error } = await supabase
      .from('registros')
      .select('*')
      .eq('id', registroId)
      .eq('upload_session_id', uploadSessionId)
      .maybeSingle();

    if (error) {
      console.error('Error consultando registro para correo:', error);
      return NextResponse.json({ error: 'Error al enviar correo' }, { status: 500 });
    }

    if (!registro) {
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
        emailErrorTipo: null,
      });
    }

    // Enviar correo
    let emailSent = false;
    let emailError = '';
    let emailErrorTipo: EmailErrorTipo | null = null;

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
          // Nunca se reenvía el texto de Resend al cliente: se clasifica por
          // `name` y se responde con mensaje propio (src/lib/email-error.ts).
          emailErrorTipo = clasificarErrorCorreo(sendError.name);
          emailError = MENSAJES_EMAIL_ERROR[emailErrorTipo];
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
        emailErrorTipo = 'otro';
        emailError = MENSAJES_EMAIL_ERROR.otro;
      }
    } else if (!resend) {
      emailError = 'Servicio de correo no configurado';
      emailErrorTipo = 'otro';
    }

    return NextResponse.json({
      success: true,
      registroId,
      emailSent,
      emailError,
      emailErrorTipo,
    });
  } catch (error) {
    console.error('Error en API correo:', error);
    return NextResponse.json(
      { error: 'Error al enviar correo' },
      { status: 500 }
    );
  }
}
