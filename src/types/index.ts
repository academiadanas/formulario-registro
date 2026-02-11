// =============================================
// ACADEMIA DANAS - Tipos TypeScript
// =============================================

// Registro de alumna (coincide con tabla registros en Supabase)
export interface Registro {
  id: number;

  // Datos personales
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  telefono_celular: string;
  correo_electronico: string;
  estado_civil: string;
  grado_estudios: string;
  fecha_nacimiento: string;

  // Lugar de nacimiento
  pais_nacimiento: string;
  estado_nacimiento: string | null;
  municipio_nacimiento: string | null;
  lugar_nacimiento: string | null;

  // Domicilio
  calle_domicilio: string;
  numero_exterior: string;
  numero_interior: string | null;
  colonia_domicilio: string;
  codigo_postal: string;
  pais_domicilio: string;
  estado_domicilio: string | null;
  municipio_domicilio: string | null;

  // Contacto familiar
  familiar_nombre: string;
  familiar_parentesco: string;
  familiar_telefono: string;
  familiar_calle: string | null;
  familiar_numero: string | null;
  familiar_colonia: string | null;
  familiar_codigo_postal: string | null;
  familiar_pais: string | null;
  familiar_estado: string | null;
  familiar_municipio: string | null;

  // Contacto de emergencia
  emergencia_nombre: string;
  emergencia_parentesco: string;
  emergencia_telefono: string;

  // Curso
  curso: string;

  // Documentos
  ruta_ine: string | null;
  ruta_acta_nacimiento: string | null;
  ruta_comprobante_domicilio: string | null;

  // Metadatos
  fecha_registro: string;
  updated_at: string;
}

// Datos del formulario de inscripción (sin id ni metadatos)
export type RegistroFormData = Omit<Registro, 'id' | 'fecha_registro' | 'updated_at'>;

// Catálogo de estados y municipios
export interface Catalogo {
  id: number;
  estado: string;
  municipio: string;
}

// Catálogos agrupados por estado
export interface CatalogosAgrupados {
  [estado: string]: string[];
}

// Admin user
export interface AdminUser {
  id: number;
  user_id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'editor' | 'viewer';
  activo: boolean;
  created_at: string;
}

// Cursos disponibles
export interface CursoOption {
  value: string;
  label: string;
  grupo: string;
  requiereDocumentos: boolean;
}

// Respuesta paginada
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pagina: number;
  totalPaginas: number;
}
