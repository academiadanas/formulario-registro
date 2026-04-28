import { createClient } from '@/lib/supabase-client';
import { FILE_CONFIG } from '@/lib/constants';

export type UploadErrorReason = 'size' | 'format' | 'network' | 'storage';

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

// Nota: si la usuaria reemplaza un archivo durante la misma sesión por uno con
// distinta extensión (p. ej. ine.jpg → ine.pdf), el archivo previo queda
// huérfano en `temp/{uploadId}/` porque el path cambia con la extensión. La
// fila en BD apunta siempre al último subido; los huérfanos se limpian aparte.
export async function uploadFile(
  file: File,
  uploadId: string,
  tipo: string
): Promise<string> {
  if (file.size > FILE_CONFIG.maxSize) {
    throw new UploadError(tipo, 'size', 'Archivo excede tamaño máximo');
  }
  if (!FILE_CONFIG.allowedTypes.includes(file.type)) {
    throw new UploadError(tipo, 'format', 'Formato de archivo no permitido');
  }

  const response = await fetch('/api/registro/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      tipo,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!response.ok) {
    throw new UploadError(tipo, 'network', 'Error al preparar la subida');
  }

  const { token, path } = await response.json();

  const supabase = createClient();
  const { error } = await supabase.storage
    .from('documentos')
    .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: true });

  if (error) {
    throw new UploadError(tipo, 'storage', 'Error al subir a Storage');
  }

  return path;
}
