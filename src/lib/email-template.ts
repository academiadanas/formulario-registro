import { Registro } from '@/types';
import { ACADEMIA_INFO } from '@/lib/constants';

// Paleta de marca (los correos requieren hex inline, sin variables CSS):
//   dorado   #b5814a  (primary)
//   rosa     #b64d84  (secondary, CTA y enlaces)
//   café     #82591e  (pie de página)
//   texto    #362920  (principal) / #7a6a5c (secundario)
//   fondos   #faf5ef (cream) / #f6efe7 (muted) / bordes #e9ddd0
export function buildEmailHTML(registro: Registro): string {
  const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`.trim();

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background-color: #b5814a; height: 4px; line-height: 4px; font-size: 0;">&nbsp;</div>

      <div style="background-color: #ffffff; padding: 28px 30px; text-align: center;">
        <img src="${ACADEMIA_INFO.logo}" alt="Academia Dana's" width="160" style="display: block; margin: 0 auto; max-width: 160px; height: auto;">
      </div>

      <div style="padding: 35px 30px; background: #ffffff;">
        <h2 style="font-family: Georgia, 'Times New Roman', serif; color: #b64d84; font-size: 24px; font-weight: bold; margin: 0 0 15px 0;">
          ¡Hola, ${nombreCompleto}!
        </h2>

        <p style="font-size: 16px; line-height: 1.6; color: #7a6a5c;">
          Gracias por registrarte en <strong>Academia Dana's</strong>.
          Hemos recibido tu solicitud de inscripción correctamente.
        </p>

        <div style="background-color: #f7ecdc; padding: 18px; margin: 25px 0; border-radius: 8px;">
          <p style="margin: 0; font-weight: bold; color: #82591e; font-size: 16px;">
            Tu número de folio es: <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 19px; font-weight: bold; color: #b5814a;">#${registro.id}</span>
          </p>
        </div>

        <h3 style="font-family: Georgia, 'Times New Roman', serif; color: #362920; font-size: 16px; margin-bottom: 10px;">Resumen de tu registro:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; background: #f6efe7; font-weight: bold; color: #7a6a5c; width: 40%;">Nombre completo</td>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; color: #362920;">${nombreCompleto}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; background: #f6efe7; font-weight: bold; color: #7a6a5c;">Correo electrónico</td>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; color: #362920;">${registro.correo_electronico}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; background: #f6efe7; font-weight: bold; color: #7a6a5c;">Teléfono celular</td>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; color: #362920;">${registro.telefono_celular}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; background: #f6efe7; font-weight: bold; color: #7a6a5c;">Curso de interés</td>
            <td style="padding: 8px 12px; border: 1px solid #e9ddd0; color: #362920;">${registro.curso}</td>
          </tr>
        </table>

        <div style="background-color: #f8eef2; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="font-size: 15px; color: #5a3d4a; margin: 0 0 15px 0;">
            Te invitamos a leer el <strong>Contrato de Prestación de Servicios Educativos</strong> antes de tu primer día de clases:
          </p>
          <a href="https://www.academiadanas.com/contrato-servicios-educativos"
             style="display: inline-block; background-color: #b64d84; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 15px;">
            Ver Contrato de Servicios Educativos
          </a>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #7a6a5c;">
          El primer día de clases se te entregará la <strong>Hoja de Aceptación</strong> para su firma.
        </p>

        <hr style="border: none; border-top: 1px solid #e9ddd0; margin: 25px 0;">

        <p style="font-size: 13px; color: #7a6a5c; line-height: 1.5;">
          También puedes consultar nuestros
          <a href="https://www.academiadanas.com/terminos-condiciones" style="color: #b64d84;">Términos y Condiciones</a>
          y nuestro
          <a href="https://www.academiadanas.com/aviso-privacidad" style="color: #b64d84;">Aviso de Privacidad</a>.
        </p>

        <hr style="border: none; border-top: 1px solid #e9ddd0; margin: 25px 0;">

        <p style="font-size: 14px; color: #7a6a5c;">
          Si tienes alguna duda, puedes contactarnos por WhatsApp al <strong>${ACADEMIA_INFO.telefono}</strong>
        </p>
      </div>

      <div style="background: #82591e; color: #ffffff; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">Academia Dana's</p>
        <p style="margin: 5px 0 0 0;">${ACADEMIA_INFO.direccion}</p>
      </div>
    </div>
  `;
}
