import { Registro } from '@/types';
import { ACADEMIA_INFO } from '@/lib/constants';

export function buildEmailHTML(registro: Registro): string {
  const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`.trim();

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #e74a82, #d22c64); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${ACADEMIA_INFO.nombre}</h1>
      </div>
      
      <div style="padding: 35px 30px; background: #ffffff;">
        <h2 style="color: #e74a82; font-size: 20px; margin-bottom: 15px;">
          ¡Hola ${nombreCompleto}!
        </h2>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
          Gracias por registrarte en <strong>${ACADEMIA_INFO.nombre}</strong>. 
          Hemos recibido tu solicitud de inscripción correctamente.
        </p>
        
        <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 18px; margin: 25px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-weight: bold; color: #2e7d32; font-size: 16px;">
            📋 Tu número de folio es: <span style="font-size: 1.4em;">#${registro.id}</span>
          </p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
          Adjunto a este correo encontrarás tu <strong>Comprobante de Inscripción y Carta Compromiso</strong> en formato PDF.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #888;">
          Nos pondremos en contacto contigo pronto para confirmar los siguientes pasos de tu inscripción.
        </p>
        
        <p style="font-size: 14px; color: #888;">
          Si tienes alguna duda, puedes contactarnos por WhatsApp al <strong>${ACADEMIA_INFO.telefono}</strong>
        </p>
      </div>
      
      <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">${ACADEMIA_INFO.nombre}</p>
        <p style="margin: 5px 0 0 0;">${ACADEMIA_INFO.direccion}</p>
      </div>
    </div>
  `;
}
