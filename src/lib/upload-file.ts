import { createClient } from '@/lib/supabase-client';
import { FILE_CONFIG } from '@/lib/constants';

export async function uploadFile(
  file: File,
  registroId: number,
  tipo: string
): Promise<string | null> {
  try {
    if (file.size > FILE_CONFIG.maxSize) return null;
    if (!FILE_CONFIG.allowedTypes.includes(file.type)) return null;

    const extension = file.name.split('.').pop() || 'pdf';
    const path = `${registroId}/${tipo}_${registroId}.${extension}`;

    const supabase = createClient();
    const { error } = await supabase.storage
      .from('documentos')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error) {
      console.error(`Error subiendo ${tipo}:`, error);
      return null;
    }

    return path;
  } catch (err) {
    console.error(`Error subiendo ${tipo}:`, err);
    return null;
  }
}
