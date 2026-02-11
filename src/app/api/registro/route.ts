import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { FILE_CONFIG } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const formData = await request.formData();

    // Extraer datos del formulario
    const registroData: Record<string, string> = {};
    const campos = [
      'nombre', 'apellido_paterno', 'apellido_materno',
      'telefono_celular', 'correo_electronico', 'estado_civil', 'grado_estudios',
      'fecha_nacimiento', 'pais_nacimiento', 'estado_nacimiento',
      'municipio_nacimiento', 'lugar_nacimiento',
      'calle_domicilio', 'numero_exterior', 'numero_interior',
      'colonia_domicilio', 'codigo_postal', 'pais_domicilio',
      'estado_domicilio', 'municipio_domicilio',
      'familiar_nombre', 'familiar_parentesco', 'familiar_telefono',
      'familiar_calle', 'familiar_numero', 'familiar_colonia',
      'familiar_codigo_postal', 'familiar_pais', 'familiar_estado',
      'familiar_municipio',
      'emergencia_nombre', 'emergencia_parentesco', 'emergencia_telefono',
      'curso',
    ];

    for (const campo of campos) {
      const valor = formData.get(campo);
      if (valor !== null && typeof valor === 'string') {
        registroData[campo] = valor.trim();
      }
    }

    // Convertir a mayúsculas los campos de texto (excepto correo)
    const camposTexto = campos.filter(
      (c) => !['correo_electronico', 'telefono_celular', 'fecha_nacimiento',
               'numero_exterior', 'numero_interior', 'codigo_postal',
               'familiar_telefono', 'familiar_numero', 'familiar_codigo_postal',
               'emergencia_telefono'].includes(c)
    );

    for (const campo of camposTexto) {
      if (registroData[campo]) {
        registroData[campo] = registroData[campo].toUpperCase();
      }
    }

    // Correo siempre en minúsculas
    if (registroData.correo_electronico) {
      registroData.correo_electronico = registroData.correo_electronico.toLowerCase();
    }

    // Insertar registro
    const { data: registro, error: insertError } = await supabase
      .from('registros')
      .insert(registroData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Error insertando registro:', insertError);
      return NextResponse.json(
        { error: 'Error al guardar el registro: ' + insertError.message },
        { status: 500 }
      );
    }

    const registroId = registro.id;

    // Procesar archivos
    const archivos = ['ine', 'acta_nacimiento', 'comprobante_domicilio'];
    const rutasArchivos: Record<string, string> = {};

    for (const archivo of archivos) {
      const file = formData.get(archivo) as File | null;

      if (file && file.size > 0) {
        // Validar tamaño
        if (file.size > FILE_CONFIG.maxSize) {
          continue;
        }

        // Validar tipo
        if (!FILE_CONFIG.allowedTypes.includes(file.type)) {
          continue;
        }

        // Determinar extensión
        const extension = file.name.split('.').pop() || 'pdf';
        const fileName = `${registroId}/${archivo}_${registroId}.${extension}`;

        // Subir a Supabase Storage
        const buffer = await file.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from('documentos')
          .upload(fileName, buffer, {
            contentType: file.type,
            upsert: true,
          });

        if (!uploadError) {
          rutasArchivos[`ruta_${archivo}`] = fileName;
        } else {
          console.error(`Error subiendo ${archivo}:`, uploadError);
        }
      }
    }

    // Actualizar registro con rutas de archivos si hay alguno
    if (Object.keys(rutasArchivos).length > 0) {
      const { error: updateError } = await supabase
        .from('registros')
        .update(rutasArchivos)
        .eq('id', registroId);

      if (updateError) {
        console.error('Error actualizando rutas:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      registroId,
    });
  } catch (error) {
    console.error('Error en API registro:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
