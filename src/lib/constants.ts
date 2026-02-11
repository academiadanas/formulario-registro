import { CursoOption } from '@/types';

// =============================================
// Cursos disponibles
// =============================================
export const CURSOS: CursoOption[] = [
  // Diplomados (acreditados por el IDEFT)
  {
    value: 'COSMETOLOGIA',
    label: 'Diplomado en Cosmetología',
    grupo: 'Diplomados (acreditados por el IDEFT)',
    requiereDocumentos: true,
  },
  {
    value: 'COSMETOLOGIA ONLINE',
    label: 'Diplomado en Cosmetología Online',
    grupo: 'Diplomados (acreditados por el IDEFT)',
    requiereDocumentos: true,
  },
  // Cursos (acreditados por el IDEFT)
  {
    value: 'CEJAS PERFECTAS',
    label: 'Curso de Cejas Perfectas',
    grupo: 'Cursos (acreditados por el IDEFT)',
    requiereDocumentos: true,
  },
  // Cursos y Talleres (en proceso de acreditación)
  {
    value: 'MICROPIGMENTACION EN OJOS',
    label: 'Curso de Micropigmentación en Ojos',
    grupo: 'Cursos y Talleres',
    requiereDocumentos: false,
  },
  {
    value: 'MICROPIGMENTACION EN LABIOS',
    label: 'Curso de Micropigmentación en Labios',
    grupo: 'Cursos y Talleres',
    requiereDocumentos: false,
  },
  {
    value: 'MASAJES RELAJANTES',
    label: 'Curso de Masajes Relajantes',
    grupo: 'Cursos y Talleres',
    requiereDocumentos: false,
  },
  {
    value: 'TRATAMIENTOS AVANZADOS',
    label: 'Taller de Tratamientos Avanzados',
    grupo: 'Cursos y Talleres',
    requiereDocumentos: false,
  },
  {
    value: 'MICROPUNTURA',
    label: 'Taller de Micropuntura',
    grupo: 'Cursos y Talleres',
    requiereDocumentos: false,
  },
];

// Agrupar cursos para el select
export const CURSOS_AGRUPADOS = CURSOS.reduce(
  (acc, curso) => {
    if (!acc[curso.grupo]) acc[curso.grupo] = [];
    acc[curso.grupo].push(curso);
    return acc;
  },
  {} as Record<string, CursoOption[]>
);

// =============================================
// Estados de EE.UU. disponibles
// =============================================
export const ESTADOS_USA = [
  { value: 'ARIZONA', label: 'Arizona' },
  { value: 'CALIFORNIA', label: 'California' },
  { value: 'COLORADO', label: 'Colorado' },
  { value: 'FLORIDA', label: 'Florida' },
  { value: 'GEORGIA', label: 'Georgia' },
  { value: 'ILLINOIS', label: 'Illinois' },
  { value: 'NEVADA', label: 'Nevada' },
  { value: 'NEW MEXICO', label: 'Nuevo México' },
  { value: 'NEW YORK', label: 'Nueva York' },
  { value: 'NORTH CAROLINA', label: 'Carolina del Norte' },
  { value: 'TEXAS', label: 'Texas' },
  { value: 'WASHINGTON', label: 'Washington' },
];

// =============================================
// Configuración de archivos
// =============================================
export const FILE_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5 MB
  allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
};

// =============================================
// Datos de la academia
// =============================================
export const ACADEMIA_INFO = {
  nombre: 'Academia Danas',
  direccion: 'Av. Revolución 192, Autlán de Navarro, Jalisco',
  codigoPostal: '48900',
  telefono: '317 132 3237',
  correo: 'academia@academiadanas.com',
  website: 'https://www.academiadanas.com',
  logo: '/logo.png',
  reglamento: 'https://tinyurl.com/reglamentoad',
};
