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
          ¡Hola, ${nombreCompleto}!
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

        <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">Resumen de tu registro:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold; color: #555; width: 40%;">Nombre completo</td>
            <td style="padding: 8px 12px; border: 1px solid #eee; color: #333;">${nombreCompleto}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold; color: #555;">Correo electrónico</td>
            <td style="padding: 8px 12px; border: 1px solid #eee; color: #333;">${registro.correo_electronico}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold; color: #555;">Teléfono celular</td>
            <td style="padding: 8px 12px; border: 1px solid #eee; color: #333;">${registro.telefono_celular}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold; color: #555;">Curso de interés</td>
            <td style="padding: 8px 12px; border: 1px solid #eee; color: #333;">${registro.curso}</td>
          </tr>
        </table>

        <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="font-size: 15px; color: #555; margin: 0 0 15px 0;">
            Te invitamos a leer el <strong>Contrato de Prestación de Servicios Educativos</strong> antes de tu primer día de clases:
          </p>
          <a href="https://www.academiadanas.com/contrato-servicios-educativos"
             style="display: inline-block; background: linear-gradient(135deg, #e74a82, #d22c64); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px;">
            📄 Ver Contrato de Servicios Educativos
          </a>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #555;">
          El primer día de clases se te entregará la <strong>Hoja de Aceptación</strong> para su firma.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">

        <p style="font-size: 13px; color: #888; line-height: 1.5;">
          También puedes consultar nuestros
          <a href="https://www.academiadanas.com/terminos-condiciones" style="color: #e74a82;">Términos y Condiciones</a>
          y nuestro
          <a href="https://www.academiadanas.com/aviso-privacidad" style="color: #e74a82;">Aviso de Privacidad</a>.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">

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
