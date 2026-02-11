import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { renderToBuffer } from '@react-pdf/renderer';
import { ComprobantePDF } from '@/lib/pdf-template';
import { buildEmailHTML } from '@/lib/email-template';
import { Resend } from 'resend';
import { Registro } from '@/types';
import { ACADEMIA_INFO } from '@/lib/constants';
import React from 'react';

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
    const { action } = await request.json().catch(() => ({ action: 'generate' }));

    if (isNaN(registroId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Obtener registro
    const supabase = await createServerSupabaseClient();
    const { data: registro, error } = await supabase
      .from('registros')
      .select('*')
      .eq('id', registroId)
      .single();

    if (error || !registro) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Generar PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfElement = React.createElement(ComprobantePDF, { registro: registro as Registro }) as any;
    const pdfBuffer = await renderToBuffer(pdfElement);
    const pdfUint8 = new Uint8Array(pdfBuffer);

    const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`.trim();
    const pdfFileName = `Comprobante_${nombreCompleto.replace(/\s+/g, '_')}_Folio_${registroId}.pdf`;

    // Si la acción es solo descargar, devolver el PDF
    if (action === 'download') {
      return new NextResponse(pdfUint8, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${pdfFileName}"`,
        },
      });
    }

    // Enviar correo
    let emailSent = false;
    let emailError = '';

    if (action === 'send' || action === 'generate') {
      if (resend && registro.correo_electronico) {
        try {
          await resend.emails.send({
            from: `${ACADEMIA_INFO.nombre} <${ACADEMIA_INFO.correo}>`,
            to: registro.correo_electronico,
            subject: `✅ Comprobante de Inscripción - ${ACADEMIA_INFO.nombre} (Folio #${registroId})`,
            html: buildEmailHTML(registro as Registro),
            attachments: [
              {
                filename: pdfFileName,
                content: Buffer.from(pdfBuffer),
              },
            ],
          });
          emailSent = true;
        } catch (err) {
          console.error('Error enviando correo:', err);
          emailError = err instanceof Error ? err.message : 'Error al enviar correo';
        }
      } else if (!resend) {
        emailError = 'Servicio de correo no configurado';
      }
    }

    // Enlace de WhatsApp
    const telefono = registro.telefono_celular;
    const mensajeWhatsApp = encodeURIComponent(
      `¡Hola ${nombreCompleto}! 🎉\n\n` +
      `Gracias por registrarte en ${ACADEMIA_INFO.nombre}.\n\n` +
      `📋 Tu folio de inscripción es: #${registroId}\n\n` +
      `Te contactaremos pronto para los siguientes pasos. ¡Gracias!`
    );
    const whatsappLink = `https://wa.me/52${telefono}?text=${mensajeWhatsApp}`;

    return NextResponse.json({
      success: true,
      registroId,
      emailSent,
      emailError,
      correoEnviado: registro.correo_electronico,
      whatsappLink,
      pdfFileName,
    });
  } catch (error) {
    console.error('Error generando PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar PDF' },
      { status: 500 }
    );
  }
}

// GET para ver/descargar el PDF directamente
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const registroId = parseInt(id);

    if (isNaN(registroId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: registro, error } = await supabase
      .from('registros')
      .select('*')
      .eq('id', registroId)
      .single();

    if (error || !registro) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfElement = React.createElement(ComprobantePDF, { registro: registro as Registro }) as any;
    const pdfBuffer = await renderToBuffer(pdfElement);
    const pdfUint8 = new Uint8Array(pdfBuffer);

    const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`.trim();
    const pdfFileName = `Comprobante_${nombreCompleto.replace(/\s+/g, '_')}_Folio_${registroId}.pdf`;

    return new NextResponse(pdfUint8, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfFileName}"`,
      },
    });
  } catch (error) {
    console.error('Error descargando PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF' },
      { status: 500 }
    );
  }
}
