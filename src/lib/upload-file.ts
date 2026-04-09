import { createClient } from '@/lib/supabase-client';
import { FILE_CONFIG } from '@/lib/constants';

export type UploadErrorReason = 'size' | 'format' | 'expired' | 'not_found' | 'network' | 'storage';

export class UploadError extends Error {
  constructor(
    public readonly tipo: string,
    public readonly reason: UploadErrorReason,
    message: string
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export async function uploadFile(
  file: File,
  registroId: number,
  tipo: string
): Promise<string> {
  // Validaciones locales
  if (file.size > FILE_CONFIG.maxSize) {
    throw new UploadError(tipo, 'size', 'Archivo excede tamaño máximo');
  }
  if (!FILE_CONFIG.allowedTypes.includes(file.type)) {
    throw new UploadError(tipo, 'format', 'Formato de archivo no permitido');
  }

  // Pedir signed upload URL al servidor
  const response = await fetch('/api/registro/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registroId,
      tipo,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new UploadError(tipo, 'expired', 'Registro expirado');
    }
    if (response.status === 404) {
      throw new UploadError(tipo, 'not_found', 'Registro no encontrado');
    }
    throw new UploadError(tipo, 'network', 'Error al preparar la subida');
  }

  const { token, path } = await response.json();

  // Subir el archivo usando la signed URL
  const supabase = createClient();
  const { error } = await supabase.storage
    .from('documentos')
    .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: true });

  if (error) {
    throw new UploadError(tipo, 'storage', 'Error al subir a Storage');
  }

  return path;
}
