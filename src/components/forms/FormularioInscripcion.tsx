'use client';

import { useState, useEffect, useMemo, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Input, Select, GroupedSelect } from '@/components/ui/FormFields';
import { WizardHeader } from '@/components/ui/WizardHeader';
import { StepNavigation } from '@/components/ui/StepNavigation';
import { ESTADOS_USA, FILE_CONFIG, ACADEMIA_INFO } from '@/lib/constants';
import { uploadFile, UploadError } from '@/lib/upload-file';
import { CatalogosAgrupados, CursoOption } from '@/types';

const TOTAL_STEPS = 6;

// Títulos mostrados en el WizardHeader (índice = currentStep - 1). El header
// muestra 7 pasos porque la pantalla de Confirmación cuenta como paso visual
// 7/7, aunque TOTAL_STEPS del wizard sigue siendo 6.
const STEP_TITLES = ['Inicio', 'Curso y documentos', 'Datos personales',
  'Domicilio', 'Datos del familiar', 'Contacto de emergencia'];

const NOMBRES_DOCUMENTOS: Record<string, string> = {
  ine_frente: 'INE o CURP (frente)',
  ine_reverso: 'INE o CURP (reverso)',
  acta_nacimiento: 'Acta de Nacimiento',
  comprobante_domicilio: 'Comprobante de Domicilio',
};

// Edad exacta (respetando mes/día) entre la fecha de nacimiento y `referencia`.
// El servidor tiene su propia copia en /api/registro: la verdad la decide él
// con fecha_nacimiento; aquí solo se usa para la validación cruzada del paso 3.
function calcularEdad(fechaNacimiento: string, referencia: Date): number {
  const nacimiento = new Date(fechaNacimiento);
  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const m = referencia.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && referencia.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

function construirMensajeErrorSubida(err: unknown): string {
  if (!(err instanceof UploadError)) {
    return 'Hubo un problema inesperado al subir tus documentos. Por favor regresa al paso 2, vuelve a seleccionar tus documentos e intenta enviar el formulario de nuevo. Si el problema persiste, contáctanos por WhatsApp al 317 132 3237 o por correo a academia@academiadanas.com.';
  }

  const nombre = NOMBRES_DOCUMENTOS[err.tipo] || err.tipo;

  switch (err.reason) {
    case 'size':
      return `Hubo un problema con tu archivo de ${nombre}: excede el tamaño máximo permitido de 5 MB. Por favor regresa al paso 2, sube un archivo más pequeño e intenta de nuevo.`;
    case 'format':
      return `Hubo un problema con tu archivo de ${nombre}: el formato no es válido. Solo se aceptan PDF, JPG y PNG. Por favor regresa al paso 2, sube un archivo con formato válido e intenta de nuevo.`;
    case 'network':
    case 'storage':
      return `Hubo un problema al subir tu archivo de ${nombre}. Por favor regresa al paso 2, vuelve a seleccionar tus documentos e intenta enviar el formulario de nuevo. Si el problema persiste, contáctanos por WhatsApp al 317 132 3237 o por correo a academia@academiadanas.com.`;
  }
}

// Solo en celulares se abre la cámara en vivo; en desktop (aunque haya
// webcam) se cae directo al input nativo, que ahí abre el explorador de
// archivos normal.
const esMobil = () =>
  /Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini/i.test(
    navigator.userAgent
  );

// Campo de captura por cámara para cualquier documento. Con soloCamara, el
// flujo es idle (botón "Tomar foto" + ejemplo) → framing (cámara en vivo con
// marco guía superpuesto) → captured (miniatura + botón "Reemplazar"). El
// marco es solo guía visual para encuadrar: NO recorta la captura (fase
// futura). Si getUserMedia falla o no existe, se cae al input nativo con
// capture="environment" como respaldo. Con soloCamara={false} (Comprobante)
// no hay cámara en vivo: selector nativo de foto/galería/archivo, como antes.
interface DocumentCaptureFieldProps {
  label: string;
  name: string;
  caption?: string;
  ejemplo?: string;
  required?: boolean;
  // true (default): cámara en vivo (o capture="environment" como respaldo).
  // false: selector nativo (foto, galería o archivo/PDF).
  soloCamara?: boolean;
  // Orientación del documento en el estado framing: 'horizontal' (default,
  // INE apaisada) o 'vertical' (acta: video más alto que ancho y marco guía
  // en franja vertical angosta).
  formatoDocumento?: 'horizontal' | 'vertical';
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}

function DocumentCaptureField({ label, name, caption, ejemplo, required, soloCamara = true, formatoDocumento = 'horizontal', file, onChange, error }: DocumentCaptureFieldProps) {
  const esImagen = file !== null && file.type.startsWith('image/');
  const previewUrl = useMemo(
    () => (file !== null && esImagen ? URL.createObjectURL(file) : null),
    [file, esImagen]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ---- Cámara en vivo (solo con soloCamara) ----
  const [framing, setFraming] = useState(false);
  // Tras un fallo de getUserMedia (sin permiso, sin cámara, sin soporte) los
  // siguientes intentos van directo al input nativo. Estado para re-render;
  // ref para el guardia síncrono del onClick del label (el .click()
  // programático del input burbujea al label en el mismo tick, antes de que
  // el estado se actualice, y sin la ref se re-interceptaría en bucle).
  const [usarRespaldo, setUsarRespaldo] = useState(false);
  const respaldoRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputIdleRef = useRef<HTMLInputElement | null>(null);

  // Estado visual del campo. 'captured' se deriva de `file` (no de un estado
  // interno) para que un clear externo — p. ej. el toggle de menor de edad
  // limpiando archivos — regrese el campo a idle sin desincronizarse.
  const modo: 'idle' | 'framing' | 'captured' = framing ? 'framing' : file !== null ? 'captured' : 'idle';

  const detenerCamara = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setFraming(false);
  };

  const activarRespaldo = () => {
    respaldoRef.current = true;
    setUsarRespaldo(true);
    // La usuaria nunca debe quedarse sin poder subir su documento: se abre el
    // input nativo. Si el navegador bloquea este click programático (la
    // activación de usuario expiró con el prompt de permiso), el siguiente
    // toque en el campo ya va directo al input.
    inputIdleRef.current?.click();
  };

  const iniciarCamara = async () => {
    if (!esMobil() || !navigator.mediaDevices?.getUserMedia) {
      activarRespaldo();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setFraming(true);
    } catch {
      activarRespaldo();
    }
  };

  // Conecta el stream al <video> cuando el estado framing ya lo montó.
  useEffect(() => {
    if (framing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [framing]);

  // Nunca dejar la cámara encendida de fondo si el componente se desmonta
  // durante framing (p. ej. la alumna navega a otro paso sin cancelar).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capturarFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    detenerCamara();
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onChange(new File([blob], `documento-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) =>
    onChange(e.target.files?.[0] || null);

  return (
    <div className="mb-5">
      <label className="block mb-2 font-medium text-text-secondary text-[0.95rem]">
        {label}
        {required && <span className="text-secondary ml-1 font-bold">*</span>}
      </label>
      {caption && <span className="block text-sm text-text-secondary italic mb-2">{caption}</span>}

      {modo === 'framing' ? (
        <div className="relative w-full overflow-hidden rounded-xl border-2 border-border-warm bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full object-cover ${formatoDocumento === 'vertical' ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}
          />
          {/* Marco guía: solo referencia visual para encuadrar, no recorta */}
          <div
            aria-hidden="true"
            className={`absolute rounded-xl border-[3px] border-primary pointer-events-none
              ${formatoDocumento === 'vertical' ? 'inset-x-8 inset-y-3 sm:inset-x-12 sm:inset-y-4' : 'inset-4 sm:inset-6'}`}
          />
          <button
            type="button"
            onClick={detenerCamara}
            aria-label="Cancelar"
            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-[rgba(54,41,32,0.7)] text-white flex items-center justify-center"
          >
            ✕
          </button>
          <div className="absolute bottom-3 inset-x-0 flex justify-center">
            <button
              type="button"
              onClick={capturarFoto}
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold
                shadow-[0_4px_15px_var(--color-primary-35)] transition-colors duration-300"
            >
              📷 Capturar
            </button>
          </div>
        </div>
      ) : modo === 'captured' && file !== null ? (
        <div
          className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border-2 rounded-xl
            ${error ? 'border-red-500 bg-red-50' : 'border-green-400 bg-green-50'}`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura de blob local, next/image no aplica
            <img
              src={previewUrl}
              alt={`Miniatura de ${label}`}
              className="w-20 h-14 object-cover rounded-lg border border-green-200 flex-shrink-0"
            />
          ) : (
            <span className="text-3xl flex-shrink-0">📄</span>
          )}
          <span className="flex-grow min-w-0 text-sm font-medium text-green-700 truncate">
            {file.name}
          </span>
          {soloCamara && !usarRespaldo ? (
            <button
              type="button"
              onClick={() => void iniciarCamara()}
              className="flex-shrink-0 text-secondary text-sm font-medium underline cursor-pointer
                transition-colors duration-300 hover:text-secondary-dark"
            >
              Reemplazar
            </button>
          ) : (
            <label
              className="flex-shrink-0 text-secondary text-sm font-medium underline cursor-pointer
                transition-colors duration-300 hover:text-secondary-dark"
            >
              Reemplazar
              <input
                type="file"
                name={name}
                accept="image/*,application/pdf"
                capture={soloCamara ? 'environment' : undefined}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      ) : (
        <label
          onClick={(e) => {
            if (soloCamara && !respaldoRef.current) {
              e.preventDefault();
              void iniciarCamara();
            }
          }}
          className={`flex flex-col items-center justify-center w-full p-4 sm:p-5 border-2 border-dashed rounded-xl cursor-pointer
            transition-all duration-300
            hover:border-primary hover:bg-primary-50
            ${error ? 'border-red-500 bg-red-50' : 'border-border-warm bg-surface-muted'}`}
        >
          <span className="text-2xl mb-1">{soloCamara ? '📷' : '📷 📁'}</span>
          <span className="text-sm font-medium text-text-secondary">
            {soloCamara ? 'Tomar foto' : 'Tomar foto o subir archivo'}
          </span>
          {ejemplo && <span className="text-xs text-text-secondary mt-1">{ejemplo}</span>}
          <span className="text-xs text-text-secondary mt-1">Máx. 5 MB</span>
          <input
            ref={inputIdleRef}
            type="file"
            name={name}
            accept="image/*,application/pdf"
            capture={soloCamara ? 'environment' : undefined}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {error && <span className="text-red-500 text-sm mt-1 block">{error}</span>}
    </div>
  );
}

export default function FormularioInscripcion() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('Enviando registro...');
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cursos cargados desde /api/programas.
  const [cursos, setCursos] = useState<CursoOption[]>([]);
  const [cursosLoading, setCursosLoading] = useState(true);
  const [cursosError, setCursosError] = useState(false);

  // UUID estable durante toda la sesión del componente. Identifica los archivos
  // subidos a temp/{uploadId}/... antes del INSERT y se persiste en BD como
  // upload_session_id para trazabilidad.
  const uploadIdRef = useRef<string>(crypto.randomUUID());

  // ---- Estado del formulario ----
  // Paso 1: Aviso de privacidad
  const [aceptaAviso, setAceptaAviso] = useState(false);

  // Paso 2: Curso y documentos
  const [curso, setCurso] = useState('');
  const [menorEdad, setMenorEdad] = useState(false);
  const [ineFrente, setIneFrente] = useState<File | null>(null);
  const [ineReverso, setIneReverso] = useState<File | null>(null);
  const [actaNacimiento, setActaNacimiento] = useState<File | null>(null);
  const [comprobanteDomicilio, setComprobanteDomicilio] = useState<File | null>(null);

  // Paso 3: Datos personales
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [sexo, setSexo] = useState('');
  const [telefonoCelular, setTelefonoCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [estadoCivilOtro, setEstadoCivilOtro] = useState('');
  const [gradoEstudios, setGradoEstudios] = useState('');
  const [gradoEstudiosOtro, setGradoEstudiosOtro] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [paisNacimiento, setPaisNacimiento] = useState('');
  const [estadoNacimientoMx, setEstadoNacimientoMx] = useState('');
  const [municipioNacimiento, setMunicipioNacimiento] = useState('');
  const [estadoNacimientoUsa, setEstadoNacimientoUsa] = useState('');
  const [otroPaisNacimiento, setOtroPaisNacimiento] = useState('');
  const [lugarNacimiento, setLugarNacimiento] = useState('');

  // Paso 4: Domicilio
  const [calleDomicilio, setCalleDomicilio] = useState('');
  const [numeroExterior, setNumeroExterior] = useState('');
  const [numeroInterior, setNumeroInterior] = useState('');
  const [coloniaDomicilio, setColoniaDomicilio] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [paisDomicilio, setPaisDomicilio] = useState('MEXICO');
  const [estadoDomicilioMx, setEstadoDomicilioMx] = useState('');
  const [municipioDomicilio, setMunicipioDomicilio] = useState('');
  const [estadoDomicilioUsa, setEstadoDomicilioUsa] = useState('');
  const [otroPaisDomicilio, setOtroPaisDomicilio] = useState('');
  const [estadoOtroDomicilio, setEstadoOtroDomicilio] = useState('');

  // Paso 5: Contacto familiar
  const [familiarNombre, setFamiliarNombre] = useState('');
  const [familiarParentesco, setFamiliarParentesco] = useState('');
  const [familiarParentescoOtro, setFamiliarParentescoOtro] = useState('');
  const [familiarTelefono, setFamiliarTelefono] = useState('');
  const [familiarCalle, setFamiliarCalle] = useState('');
  const [familiarNumero, setFamiliarNumero] = useState('');
  const [familiarColonia, setFamiliarColonia] = useState('');
  const [familiarCp, setFamiliarCp] = useState('');
  const [familiarPais, setFamiliarPais] = useState('MEXICO');
  const [familiarEstadoMx, setFamiliarEstadoMx] = useState('');
  const [familiarMunicipio, setFamiliarMunicipio] = useState('');
  const [familiarEstadoUsa, setFamiliarEstadoUsa] = useState('');
  const [otroPaisFamiliar, setOtroPaisFamiliar] = useState('');
  const [estadoOtroFamiliar, setEstadoOtroFamiliar] = useState('');

  // Paso 6: Contacto de emergencia
  const [emergenciaNombre, setEmergenciaNombre] = useState('');
  const [emergenciaParentesco, setEmergenciaParentesco] = useState('');
  const [emergenciaParentescoOtro, setEmergenciaParentescoOtro] = useState('');
  const [emergenciaTelefono, setEmergenciaTelefono] = useState('');

  // ---- Cargar catálogos ----
  useEffect(() => {
    fetch('/api/catalogos')
      .then((res) => res.json())
      .then((data) => setCatalogos(data))
      .catch((err) => console.error('Error cargando catálogos:', err));
  }, []);

  // ---- Cargar cursos desde /api/programas ----
  useEffect(() => {
    async function cargarCursos() {
      try {
        const res = await fetch('/api/programas');
        if (!res.ok) {
          throw new Error(`Respuesta no-ok: ${res.status}`);
        }
        const data: CursoOption[] = await res.json();
        setCursos(data);
        setCursosError(false);
      } catch (err) {
        console.error('Error cargando programas:', err);
        setCursosError(true);
      } finally {
        setCursosLoading(false);
      }
    }
    cargarCursos();
  }, []);

  // ---- Helpers ----
  const requiereDocumentos = cursos.find((c) => c.value === curso)?.requiereDocumentos ?? false;

  const estadosMexico = Object.keys(catalogos).sort().map((e) => ({ value: e, label: e }));

  const getMunicipios = (estado: string) =>
    (catalogos[estado] || []).map((m) => ({ value: m, label: m }));

  const paisesOptions = [
    { value: 'MEXICO', label: 'México' },
    { value: 'ESTADOS UNIDOS', label: 'Estados Unidos' },
    { value: 'OTRO', label: 'Otro país' },
  ];

  // Agrupar los cursos (array plano de /api/programas) por `grupo` para el
  // GroupedSelect. Forma de salida: Record<string, { value, label }[]>.
  const cursosParaSelect = cursos.reduce(
    (acc, c) => {
      if (!acc[c.grupo]) acc[c.grupo] = [];
      acc[c.grupo].push({ value: c.value, label: c.label });
      return acc;
    },
    {} as Record<string, { value: string; label: string }[]>
  );

  // ---- Validación por paso ----
  function validateFile(file: File | null, fieldName: string): boolean {
    if (!file) return true;
    if (file.size > FILE_CONFIG.maxSize) {
      setErrors((prev) => ({ ...prev, [fieldName]: 'El archivo excede 5 MB' }));
      return false;
    }
    if (!FILE_CONFIG.allowedTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [fieldName]: 'Solo se permiten PDF, JPG y PNG' }));
      return false;
    }
    return true;
  }

  function validateStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!aceptaAviso) {
          newErrors.aviso = 'Debes aceptar el Aviso de Privacidad';
        }
        break;

      case 2:
        // Si los programas no cargaron, no se puede seleccionar curso: bloquear avance.
        if (cursosError) {
          newErrors.curso = 'No se pudieron cargar los programas. Por favor recarga la página.';
          setErrors(newErrors);
          return false;
        }
        if (!curso) newErrors.curso = 'Selecciona un curso';
        if (requiereDocumentos) {
          if (menorEdad) {
            // Menor de edad: acta + comprobante; no se pide INE.
            if (!actaNacimiento) newErrors.acta = 'El acta de nacimiento es obligatoria';
            if (!comprobanteDomicilio) newErrors.comprobante = 'El comprobante de domicilio es obligatorio';
            if (actaNacimiento && !validateFile(actaNacimiento, 'acta')) return false;
            if (comprobanteDomicilio && !validateFile(comprobanteDomicilio, 'comprobante')) return false;
          } else {
            // Adulto: INE (ambos lados) + comprobante; no se pide acta.
            if (!ineFrente) newErrors.ineFrente = 'Falta la foto del frente de la INE';
            if (!ineReverso) newErrors.ineReverso = 'Falta la foto del reverso de la INE';
            if (!comprobanteDomicilio) newErrors.comprobante = 'El comprobante de domicilio es obligatorio';
            if (ineFrente && !validateFile(ineFrente, 'ineFrente')) return false;
            if (ineReverso && !validateFile(ineReverso, 'ineReverso')) return false;
            if (comprobanteDomicilio && !validateFile(comprobanteDomicilio, 'comprobante')) return false;
          }
        }
        break;

      case 3:
        if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
        if (!apellidoPaterno.trim()) newErrors.apellidoPaterno = 'El apellido paterno es obligatorio';
        if (!apellidoMaterno.trim()) newErrors.apellidoMaterno = 'El apellido materno es obligatorio';
        if (!sexo) newErrors.sexo = 'Selecciona el sexo';
        if (!telefonoCelular.trim() || telefonoCelular.length !== 10)
          newErrors.telefono = 'Ingresa un teléfono de 10 dígitos';
        if (!correo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
          newErrors.correo = 'Ingresa un correo válido';
        if (!estadoCivil) newErrors.estadoCivil = 'Selecciona el estado civil';
        if (estadoCivil === 'otro' && !estadoCivilOtro.trim())
          newErrors.estadoCivilOtro = 'Especifica el estado civil';
        if (!gradoEstudios) newErrors.gradoEstudios = 'Selecciona el grado de estudios';
        if (gradoEstudios === 'otro' && !gradoEstudiosOtro.trim())
          newErrors.gradoEstudiosOtro = 'Especifica el grado de estudios';
        if (!fechaNacimiento) {
          newErrors.fechaNacimiento = 'Selecciona la fecha de nacimiento';
        } else if (
          requiereDocumentos &&
          (calcularEdad(fechaNacimiento, new Date()) < 18) !== menorEdad
        ) {
          newErrors.fechaNacimiento =
            "Esto no coincide con lo que indicaste en el paso de documentos. Regresa al paso 2 y ajusta la casilla 'Soy menor de 18 años'.";
        }
        if (!paisNacimiento) newErrors.paisNacimiento = 'Selecciona el país';
        if (paisNacimiento === 'MEXICO') {
          if (!estadoNacimientoMx) newErrors.estadoNacimientoMx = 'Selecciona el estado';
          if (!municipioNacimiento) newErrors.municipioNacimiento = 'Selecciona el municipio';
        } else if (paisNacimiento === 'ESTADOS UNIDOS') {
          if (!estadoNacimientoUsa) newErrors.estadoNacimientoUsa = 'Selecciona el estado';
        } else if (paisNacimiento === 'OTRO') {
          if (!otroPaisNacimiento.trim()) newErrors.otroPais = 'Escribe el nombre del país';
          if (!lugarNacimiento.trim()) newErrors.lugarNacimiento = 'Escribe el lugar de nacimiento';
        }
        break;

      case 4:
        if (!calleDomicilio.trim()) newErrors.calle = 'La calle es obligatoria';
        if (!numeroExterior.trim()) newErrors.numExt = 'El número exterior es obligatorio';
        if (!coloniaDomicilio.trim()) newErrors.colonia = 'La colonia es obligatoria';
        if (!codigoPostal.trim() || codigoPostal.length !== 5)
          newErrors.cp = 'Ingresa un código postal de 5 dígitos';
        if (!paisDomicilio) newErrors.paisDom = 'Selecciona el país';
        if (paisDomicilio === 'MEXICO') {
          if (!estadoDomicilioMx) newErrors.estadoDom = 'Selecciona el estado';
          if (!municipioDomicilio) newErrors.municipioDom = 'Selecciona el municipio';
        } else if (paisDomicilio === 'ESTADOS UNIDOS') {
          if (!estadoDomicilioUsa) newErrors.estadoDomUsa = 'Selecciona el estado';
        } else if (paisDomicilio === 'OTRO') {
          if (!otroPaisDomicilio.trim()) newErrors.otroPaisDom = 'Escribe el nombre del país';
          if (!estadoOtroDomicilio.trim()) newErrors.estadoOtroDom = 'Escribe el estado o provincia';
        }
        break;

      case 5:
        if (!familiarNombre.trim()) newErrors.famNombre = 'El nombre es obligatorio';
        if (!familiarParentesco) newErrors.famParentesco = 'Selecciona el parentesco';
        if (familiarParentesco === 'otro' && !familiarParentescoOtro.trim())
          newErrors.famParentescoOtro = 'Especifica el parentesco';
        if (!familiarTelefono.trim() || familiarTelefono.length !== 10)
          newErrors.famTelefono = 'Ingresa un teléfono de 10 dígitos';
        if (!familiarCalle.trim()) newErrors.famCalle = 'La calle es obligatoria';
        if (!familiarNumero.trim()) newErrors.famNumero = 'El número es obligatorio';
        if (!familiarColonia.trim()) newErrors.famColonia = 'La colonia es obligatoria';
        if (!familiarCp.trim() || familiarCp.length !== 5)
          newErrors.famCp = 'Ingresa un código postal de 5 dígitos';
        if (familiarPais === 'MEXICO') {
          if (!familiarEstadoMx) newErrors.famEstado = 'Selecciona el estado';
          if (!familiarMunicipio) newErrors.famMunicipio = 'Selecciona el municipio';
        } else if (familiarPais === 'ESTADOS UNIDOS') {
          if (!familiarEstadoUsa) newErrors.famEstadoUsa = 'Selecciona el estado';
        } else if (familiarPais === 'OTRO') {
          if (!otroPaisFamiliar.trim()) newErrors.otroPaisFam = 'Escribe el nombre del país';
          if (!estadoOtroFamiliar.trim()) newErrors.estadoOtroFam = 'Escribe el estado o provincia';
        }
        break;

      case 6:
        if (!emergenciaNombre.trim()) newErrors.emNombre = 'El nombre es obligatorio';
        if (!emergenciaParentesco) newErrors.emParentesco = 'Selecciona el parentesco';
        if (emergenciaParentesco === 'otro' && !emergenciaParentescoOtro.trim())
          newErrors.emParentescoOtro = 'Especifica el parentesco';
        if (!emergenciaTelefono.trim() || emergenciaTelefono.length !== 10)
          newErrors.emTelefono = 'Ingresa un teléfono de 10 dígitos';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ---- Navegación ----
  function handleNext() {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handlePrev() {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Enviar formulario ----
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    setSubmitStatus('Enviando registro...');

    try {
      // Construir payload JSON (sin archivos)
      const payload: Record<string, string> = {
        curso,
        nombre,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno,
        sexo,
        telefono_celular: telefonoCelular,
        correo_electronico: correo,
        estado_civil: estadoCivil === 'otro' ? estadoCivilOtro : estadoCivil,
        grado_estudios: gradoEstudios === 'otro' ? gradoEstudiosOtro : gradoEstudios,
        fecha_nacimiento: fechaNacimiento,
        calle_domicilio: calleDomicilio,
        numero_exterior: numeroExterior,
        colonia_domicilio: coloniaDomicilio,
        codigo_postal: codigoPostal,
        familiar_nombre: familiarNombre,
        familiar_parentesco: familiarParentesco === 'otro' ? familiarParentescoOtro : familiarParentesco,
        familiar_telefono: familiarTelefono,
        familiar_calle: familiarCalle,
        familiar_numero: familiarNumero,
        familiar_colonia: familiarColonia,
        familiar_codigo_postal: familiarCp,
        emergencia_nombre: emergenciaNombre,
        emergencia_parentesco: emergenciaParentesco === 'otro' ? emergenciaParentescoOtro : emergenciaParentesco,
        emergencia_telefono: emergenciaTelefono,
      };

      if (numeroInterior) payload.numero_interior = numeroInterior;

      if (paisNacimiento === 'MEXICO') {
        payload.pais_nacimiento = 'MEXICO';
        payload.estado_nacimiento = estadoNacimientoMx;
        payload.municipio_nacimiento = municipioNacimiento;
      } else if (paisNacimiento === 'ESTADOS UNIDOS') {
        payload.pais_nacimiento = 'ESTADOS UNIDOS';
        payload.estado_nacimiento = estadoNacimientoUsa;
      } else if (paisNacimiento === 'OTRO') {
        payload.pais_nacimiento = otroPaisNacimiento;
        payload.lugar_nacimiento = lugarNacimiento;
      }

      if (paisDomicilio === 'MEXICO') {
        payload.pais_domicilio = 'MEXICO';
        payload.estado_domicilio = estadoDomicilioMx;
        payload.municipio_domicilio = municipioDomicilio;
      } else if (paisDomicilio === 'ESTADOS UNIDOS') {
        payload.pais_domicilio = 'ESTADOS UNIDOS';
        payload.estado_domicilio = estadoDomicilioUsa;
      } else if (paisDomicilio === 'OTRO') {
        payload.pais_domicilio = otroPaisDomicilio;
        payload.estado_domicilio = estadoOtroDomicilio;
      }

      if (familiarPais === 'MEXICO') {
        payload.familiar_pais = 'MEXICO';
        payload.familiar_estado = familiarEstadoMx;
        payload.familiar_municipio = familiarMunicipio;
      } else if (familiarPais === 'ESTADOS UNIDOS') {
        payload.familiar_pais = 'ESTADOS UNIDOS';
        payload.familiar_estado = familiarEstadoUsa;
      } else if (familiarPais === 'OTRO') {
        payload.familiar_pais = otroPaisFamiliar;
        payload.familiar_estado = estadoOtroFamiliar;
      }

      // Paso 1: subir archivos a temp/{uploadId}/... ANTES de insertar en BD
      const rutas: { ruta_ine_frente?: string; ruta_ine_reverso?: string; ruta_acta_nacimiento?: string; ruta_comprobante_domicilio?: string } = {};

      const tieneArchivosQueSubir = ineFrente !== null || ineReverso !== null || actaNacimiento !== null || comprobanteDomicilio !== null;

      if (tieneArchivosQueSubir) {
        setSubmitStatus('Subiendo documentos...');
        try {
          if (ineFrente) rutas.ruta_ine_frente = await uploadFile(ineFrente, uploadIdRef.current, 'ine_frente');
          if (ineReverso) rutas.ruta_ine_reverso = await uploadFile(ineReverso, uploadIdRef.current, 'ine_reverso');
          if (actaNacimiento) rutas.ruta_acta_nacimiento = await uploadFile(actaNacimiento, uploadIdRef.current, 'acta_nacimiento');
          if (comprobanteDomicilio) rutas.ruta_comprobante_domicilio = await uploadFile(comprobanteDomicilio, uploadIdRef.current, 'comprobante_domicilio');
        } catch (err) {
          const mensaje = construirMensajeErrorSubida(err);
          setErrors({ submit: mensaje });
          setIsSubmitting(false);
          return;
        }
      }

      // Paso 2: INSERT atómico con datos + rutas + uploadId
      setSubmitStatus('Guardando registro...');
      const response = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          uploadId: uploadIdRef.current,
          rutas,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        setErrors({ submit: result.error || 'Error al enviar el registro' });
        return;
      }

      const registroId: number = result.registroId;

      router.push(`/inscripcion/gracias?id=${registroId}`);
    } catch (error) {
      console.error('Error:', error);
      setErrors({ submit: 'Error de conexión. Por favor intenta de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---- Solo números en campos de teléfono ----
  function handlePhoneInput(value: string, setter: (v: string) => void) {
    setter(value.replace(/\D/g, '').slice(0, 10));
  }

  function handleCpInput(value: string, setter: (v: string) => void) {
    setter(value.replace(/\D/g, '').slice(0, 5));
  }

  // ---- RENDER ----
  return (
    <form onSubmit={handleSubmit} className="max-w-[680px] mx-auto bg-surface rounded-3xl shadow-xl overflow-hidden animate-[fadeInUp_0.6s_ease]">
      {/* Header */}
      <WizardHeader title={STEP_TITLES[currentStep - 1]} currentStep={currentStep} totalSteps={7} />

      {/* Error general */}
      {errors.submit && (
        <div className="mx-5 sm:mx-8 mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-center">
          {errors.submit}
        </div>
      )}

      {/* PASO 1: Aviso de Privacidad */}
      {currentStep === 1 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <div className="text-center mb-6">
            <Image
              src={ACADEMIA_INFO.logo}
              alt="Academia Danas"
              width={160}
              height={80}
              className="mx-auto mb-4 drop-shadow-md"
              priority
            />
            <h2 className="font-serif text-text-primary text-2xl font-semibold mb-2">
              Comienza tu inscripción
            </h2>
            <p className="text-text-secondary text-sm">
              Completa tu registro en aproximadamente 10 minutos.
            </p>
          </div>

          <div className="bg-secondary-50 border border-secondary-light rounded-2xl p-4 mb-6">
            <h2 className="font-serif text-text-primary text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              🔒 Aviso de privacidad
            </h2>
            <p className="text-text-secondary text-[0.95rem] mb-4 leading-relaxed">
              <strong>Academia Dana&apos;s</strong>, con domicilio en Av. Revolución No. 190, Int. 2,
              Colonia Centro, Autlán de Navarro, Jalisco, C.P. 48900, México, es el
              responsable del uso y protección de sus datos personales.
            </p>
            <div className="space-y-3 my-5">
              <div className="p-3 px-4 pl-12 bg-surface-muted rounded-lg relative text-sm text-text-secondary">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-text-secondary text-white rounded-full flex items-center justify-center text-[0.65rem] font-bold">✓</span>
                Para llevar a cabo la inscripción del alumno en nuestro sistema de control escolar.
              </div>
              <div className="p-3 px-4 pl-12 bg-surface-muted rounded-lg relative text-sm text-text-secondary">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-text-secondary text-white rounded-full flex items-center justify-center text-[0.65rem] font-bold">✓</span>
                Trámite de registro ante el Instituto de Formación para el Trabajo del Estado de Jalisco (IDEFT).
              </div>
            </div>
            <p className="text-text-secondary text-sm">
              Para conocer mayor información, consulta el aviso de privacidad en:{' '}
              <a href="https://academiadanas.com/aviso-privacidad" target="_blank" className="text-secondary font-medium hover:underline">
                academiadanas.com/aviso-privacidad
              </a>
            </p>
          </div>

          <label
            className={`flex items-start gap-3 p-4 sm:p-5 rounded-xl border-2 cursor-pointer transition-all
              ${aceptaAviso ? 'bg-primary-50 border-primary' : 'bg-surface-muted border-border-warm hover:border-primary'}`}
          >
            <input
              type="checkbox"
              checked={aceptaAviso}
              onChange={(e) => setAceptaAviso(e.target.checked)}
              className="w-5 h-5 accent-primary mt-0.5 flex-shrink-0"
            />
            <span className="text-[0.95rem]">
              He leído y acepto el aviso de privacidad
              <span className="text-secondary font-bold ml-1">*</span>
            </span>
          </label>
          {errors.aviso && (
            <span className="text-red-500 text-sm mt-2 block">{errors.aviso}</span>
          )}

          <StepNavigation
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onPrev={handlePrev}
            onNext={handleNext}
            nextLabel="Comenzar inscripción"
          />
        </div>
      )}

      {/* PASO 2: Curso y Documentos */}
      {currentStep === 2 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <div className="mb-6">
            <h2 className="font-serif text-text-primary text-2xl font-semibold mb-2">
              Tu curso y documentos
            </h2>
            <p className="text-text-secondary text-sm">
              Elige el curso o diplomado de tu interés.
            </p>
          </div>

          {cursosLoading ? (
            <div className="bg-surface-muted border border-border-warm p-4 rounded-xl mb-6 flex items-center gap-3">
              <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-text-secondary text-sm">Cargando programas...</p>
            </div>
          ) : cursosError ? (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl mb-6">
              <p className="text-red-800 text-sm">
                ⚠️ <strong>No se pudieron cargar los programas.</strong><br />
                <span className="text-sm">Por favor recarga la página e intenta de nuevo.</span>
              </p>
            </div>
          ) : (
            <GroupedSelect
              label="Curso de Interés"
              groups={cursosParaSelect}
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              placeholder="-- Selecciona un curso --"
              required
              error={errors.curso}
            />
          )}

          {curso && requiereDocumentos && (
            <div className="animate-[fadeIn_0.3s_ease]">
              <label
                className={`flex items-center justify-between gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all mb-6
                  ${menorEdad ? 'bg-primary-50 border-primary' : 'bg-surface-muted border-border-warm hover:border-primary'}`}
              >
                <span className="text-[0.95rem] font-medium text-text-primary">Soy menor de 18 años</span>
                <input
                  type="checkbox"
                  checked={menorEdad}
                  onChange={(e) => {
                    const esMenor = e.target.checked;
                    setMenorEdad(esMenor);
                    // Limpia los archivos del lado que se oculta para no subir
                    // documentos que ya no aplican tras cambiar de opción.
                    if (esMenor) {
                      setIneFrente(null);
                      setIneReverso(null);
                    } else {
                      setActaNacimiento(null);
                    }
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-300
                    ${menorEdad ? 'bg-primary' : 'bg-border-warm'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300
                      ${menorEdad ? 'translate-x-5' : ''}`}
                  />
                </span>
              </label>

              {menorEdad ? (
                <DocumentCaptureField
                  label="Acta de nacimiento"
                  name="acta_nacimiento"
                  caption="Acta completa, legible y sin cortes"
                  formatoDocumento="vertical"
                  required
                  file={actaNacimiento}
                  onChange={setActaNacimiento}
                  error={errors.acta}
                />
              ) : (
                <>
                  <DocumentCaptureField
                    label="INE — Frente"
                    name="ine_frente"
                    caption="Frente de tu identificación oficial, completo y legible"
                    ejemplo="El lado con tu fotografía"
                    required
                    file={ineFrente}
                    onChange={setIneFrente}
                    error={errors.ineFrente}
                  />

                  <DocumentCaptureField
                    label="INE — Reverso"
                    name="ine_reverso"
                    caption="Reverso de tu identificación oficial, completo y legible"
                    ejemplo="El lado con el código QR"
                    required
                    file={ineReverso}
                    onChange={setIneReverso}
                    error={errors.ineReverso}
                  />
                </>
              )}

              <DocumentCaptureField
                label="Comprobante de domicilio"
                name="comprobante_domicilio"
                caption="Recibo de luz, agua o teléfono, no mayor a 3 meses"
                required
                soloCamara={false}
                file={comprobanteDomicilio}
                onChange={setComprobanteDomicilio}
                error={errors.comprobante}
              />
            </div>
          )}

          {curso && !requiereDocumentos && (
            <div className="bg-green-50 border-l-4 border-green-500 p-5 rounded-r-xl animate-[fadeIn_0.3s_ease]">
              <p className="text-green-800 text-[0.95rem]">
                ✅ <strong>Este curso no requiere documentos.</strong><br />
                <span className="text-sm">Puedes continuar con el siguiente paso.</span>
              </p>
            </div>
          )}

          <StepNavigation
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>
      )}

      {/* PASO 3: Datos Personales */}
      {currentStep === 3 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <div className="mb-6">
            <h2 className="font-serif text-text-primary text-2xl font-semibold mb-2">
              Datos personales
            </h2>
            <p className="text-text-secondary text-sm">
              Cuéntanos quién eres.
            </p>
          </div>

          <Input label="Nombre(s)" value={nombre} onChange={(e) => setNombre(e.target.value)} required error={errors.nombre} />
          <Input label="Apellido Paterno" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} required error={errors.apellidoPaterno} />
          <Input label="Apellido Materno" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} required error={errors.apellidoMaterno} />
          <Select
            label="Sexo"
            options={[
              { value: 'Mujer', label: 'Mujer' },
              { value: 'Hombre', label: 'Hombre' },
            ]}
            value={sexo}
            onChange={(e) => setSexo(e.target.value)}
            placeholder="Selecciona…"
            required
            error={errors.sexo}
          />
          <Input label="Teléfono Celular" placeholder="10 dígitos" value={telefonoCelular} onChange={(e) => handlePhoneInput(e.target.value, setTelefonoCelular)} required inputMode="numeric" maxLength={10} error={errors.telefono} />
          <Input label="Correo Electrónico" type="email" placeholder="tucorreo@ejemplo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} required error={errors.correo} />

          <Select
            label="Estado Civil"
            options={[
              { value: 'Soltero/a', label: 'Soltero/a' },
              { value: 'Casado/a', label: 'Casado/a' },
              { value: 'otro', label: 'Otro' },
            ]}
            value={estadoCivil}
            onChange={(e) => setEstadoCivil(e.target.value)}
            placeholder="Selecciona…"
            required
            error={errors.estadoCivil}
          />

          {estadoCivil === 'otro' && (
            <Input
              placeholder="Especifica"
              aria-label="Especifica tu estado civil"
              value={estadoCivilOtro}
              onChange={(e) => setEstadoCivilOtro(e.target.value)}
              error={errors.estadoCivilOtro}
            />
          )}

          <Select
            label="Último Grado de Estudios"
            options={[
              { value: 'Primaria', label: 'Primaria' },
              { value: 'Secundaria', label: 'Secundaria' },
              { value: 'Preparatoria', label: 'Preparatoria / Bachillerato' },
              { value: 'Licenciatura', label: 'Licenciatura' },
              { value: 'Posgrado', label: 'Posgrado' },
              { value: 'otro', label: 'Otro' },
            ]}
            value={gradoEstudios}
            onChange={(e) => setGradoEstudios(e.target.value)}
            placeholder="Selecciona…"
            required
            error={errors.gradoEstudios}
          />

          {gradoEstudios === 'otro' && (
            <Input
              placeholder="Especifica"
              aria-label="Especifica tu grado de estudios"
              value={gradoEstudiosOtro}
              onChange={(e) => setGradoEstudiosOtro(e.target.value)}
              error={errors.gradoEstudiosOtro}
            />
          )}

          <Input label="Fecha de Nacimiento" type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} required error={errors.fechaNacimiento} />

          <Select
            label="País de Nacimiento"
            options={paisesOptions}
            value={paisNacimiento}
            onChange={(e) => {
              setPaisNacimiento(e.target.value);
              setEstadoNacimientoMx('');
              setMunicipioNacimiento('');
              setEstadoNacimientoUsa('');
              setOtroPaisNacimiento('');
              setLugarNacimiento('');
            }}
            placeholder="-- Selecciona un país --"
            required
            error={errors.paisNacimiento}
          />

          {paisNacimiento === 'MEXICO' && (
            <>
              <Select label="Estado de Nacimiento" options={estadosMexico} value={estadoNacimientoMx}
                onChange={(e) => { setEstadoNacimientoMx(e.target.value); setMunicipioNacimiento(''); }}
                placeholder="-- Selecciona un estado --" required error={errors.estadoNacimientoMx} />
              <Select label="Municipio de Nacimiento" options={getMunicipios(estadoNacimientoMx)} value={municipioNacimiento}
                onChange={(e) => setMunicipioNacimiento(e.target.value)}
                placeholder={estadoNacimientoMx ? '-- Selecciona un municipio --' : '-- Primero selecciona un estado --'}
                required error={errors.municipioNacimiento} />
            </>
          )}

          {paisNacimiento === 'ESTADOS UNIDOS' && (
            <Select label="Estado de Nacimiento" options={ESTADOS_USA} value={estadoNacimientoUsa}
              onChange={(e) => setEstadoNacimientoUsa(e.target.value)}
              placeholder="-- Selecciona un estado --" required error={errors.estadoNacimientoUsa} />
          )}

          {paisNacimiento === 'OTRO' && (
            <>
              <Input label="¿Cuál país?" value={otroPaisNacimiento} onChange={(e) => setOtroPaisNacimiento(e.target.value)} required error={errors.otroPais} placeholder="Escribe el nombre del país" />
              <Input label="Lugar de Nacimiento (Ciudad/Estado)" value={lugarNacimiento} onChange={(e) => setLugarNacimiento(e.target.value)} required error={errors.lugarNacimiento} placeholder="Ej: Ciudad de Guatemala, Guatemala" />
            </>
          )}

          <StepNavigation currentStep={currentStep} totalSteps={TOTAL_STEPS} onPrev={handlePrev} onNext={handleNext} />
        </div>
      )}

      {/* PASO 4: Domicilio */}
      {currentStep === 4 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <div className="mb-6">
            <h2 className="font-serif text-text-primary text-2xl font-semibold mb-2">
              Domicilio
            </h2>
            <p className="text-text-secondary text-sm">
              ¿Dónde vives?
            </p>
          </div>

          <Input label="Calle" value={calleDomicilio} onChange={(e) => setCalleDomicilio(e.target.value)} required error={errors.calle} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número exterior" value={numeroExterior} onChange={(e) => setNumeroExterior(e.target.value)} required error={errors.numExt} />
            <Input label="Número interior" value={numeroInterior} onChange={(e) => setNumeroInterior(e.target.value)} />
          </div>
          <Input label="Colonia / Localidad" value={coloniaDomicilio} onChange={(e) => setColoniaDomicilio(e.target.value)} required error={errors.colonia} />
          <Input label="Código postal" value={codigoPostal} onChange={(e) => handleCpInput(e.target.value, setCodigoPostal)} required inputMode="numeric" maxLength={5} error={errors.cp} />

          <Select label="País" options={paisesOptions} value={paisDomicilio}
            onChange={(e) => {
              setPaisDomicilio(e.target.value);
              setEstadoDomicilioMx(''); setMunicipioDomicilio('');
              setEstadoDomicilioUsa(''); setOtroPaisDomicilio(''); setEstadoOtroDomicilio('');
            }}
            placeholder="Selecciona…" required error={errors.paisDom} />

          {paisDomicilio === 'MEXICO' && (
            <>
              <Select label="Estado" options={estadosMexico} value={estadoDomicilioMx}
                onChange={(e) => { setEstadoDomicilioMx(e.target.value); setMunicipioDomicilio(''); }}
                placeholder="Selecciona…" required error={errors.estadoDom} />
              <Select label="Municipio" options={getMunicipios(estadoDomicilioMx)} value={municipioDomicilio}
                onChange={(e) => setMunicipioDomicilio(e.target.value)}
                placeholder={estadoDomicilioMx ? 'Selecciona…' : 'Primero selecciona un estado'}
                required error={errors.municipioDom} />
            </>
          )}

          {paisDomicilio === 'ESTADOS UNIDOS' && (
            <Select label="Estado" options={ESTADOS_USA} value={estadoDomicilioUsa}
              onChange={(e) => setEstadoDomicilioUsa(e.target.value)}
              placeholder="Selecciona…" required error={errors.estadoDomUsa} />
          )}

          {paisDomicilio === 'OTRO' && (
            <>
              <Input label="¿Cuál país?" value={otroPaisDomicilio} onChange={(e) => setOtroPaisDomicilio(e.target.value)} required error={errors.otroPaisDom} placeholder="Escribe el nombre del país" />
              <Input label="Estado/Provincia" value={estadoOtroDomicilio} onChange={(e) => setEstadoOtroDomicilio(e.target.value)} required error={errors.estadoOtroDom} placeholder="Escribe el estado o provincia" />
            </>
          )}

          <StepNavigation currentStep={currentStep} totalSteps={TOTAL_STEPS} onPrev={handlePrev} onNext={handleNext} />
        </div>
      )}

      {/* PASO 5: Contacto Familiar */}
      {currentStep === 5 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <div className="mb-6">
            <h2 className="font-serif text-text-primary text-2xl font-semibold mb-2">
              Datos del familiar
            </h2>
            <p className="text-text-secondary text-sm">
              Comparte el contacto de un familiar.
            </p>
          </div>

          <Input label="Nombre completo" value={familiarNombre} onChange={(e) => setFamiliarNombre(e.target.value)} required error={errors.famNombre} />

          <Select
            label="Parentesco"
            options={[
              { value: 'Mamá', label: 'Mamá' },
              { value: 'Papá', label: 'Papá' },
              { value: 'Hermano/a', label: 'Hermano/a' },
              { value: 'Cónyuge', label: 'Cónyuge' },
              { value: 'Tutor/a', label: 'Tutor/a' },
              { value: 'otro', label: 'Otro' },
            ]}
            value={familiarParentesco}
            onChange={(e) => setFamiliarParentesco(e.target.value)}
            placeholder="Selecciona…"
            required
            error={errors.famParentesco}
          />

          {familiarParentesco === 'otro' && (
            <Input
              placeholder="Especifica"
              aria-label="Especifica el parentesco"
              value={familiarParentescoOtro}
              onChange={(e) => setFamiliarParentescoOtro(e.target.value)}
              error={errors.famParentescoOtro}
            />
          )}

          <Input label="Teléfono" placeholder="10 dígitos" value={familiarTelefono} onChange={(e) => handlePhoneInput(e.target.value, setFamiliarTelefono)} required inputMode="numeric" maxLength={10} error={errors.famTelefono} />
          <Input label="Calle" value={familiarCalle} onChange={(e) => setFamiliarCalle(e.target.value)} required error={errors.famCalle} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número" value={familiarNumero} onChange={(e) => setFamiliarNumero(e.target.value)} required error={errors.famNumero} />
            <Input label="Código postal" value={familiarCp} onChange={(e) => handleCpInput(e.target.value, setFamiliarCp)} required inputMode="numeric" maxLength={5} error={errors.famCp} />
          </div>
          <Input label="Colonia / Localidad" value={familiarColonia} onChange={(e) => setFamiliarColonia(e.target.value)} required error={errors.famColonia} />

          <Select label="País" options={paisesOptions} value={familiarPais}
            onChange={(e) => {
              setFamiliarPais(e.target.value);
              setFamiliarEstadoMx(''); setFamiliarMunicipio('');
              setFamiliarEstadoUsa(''); setOtroPaisFamiliar(''); setEstadoOtroFamiliar('');
            }}
            placeholder="Selecciona…" required error={errors.famPais} />

          {familiarPais === 'MEXICO' && (
            <>
              <Select label="Estado" options={estadosMexico} value={familiarEstadoMx}
                onChange={(e) => { setFamiliarEstadoMx(e.target.value); setFamiliarMunicipio(''); }}
                placeholder="Selecciona…" required error={errors.famEstado} />
              <Select label="Municipio" options={getMunicipios(familiarEstadoMx)} value={familiarMunicipio}
                onChange={(e) => setFamiliarMunicipio(e.target.value)}
                placeholder={familiarEstadoMx ? 'Selecciona…' : 'Primero selecciona un estado'}
                required error={errors.famMunicipio} />
            </>
          )}

          {familiarPais === 'ESTADOS UNIDOS' && (
            <Select label="Estado" options={ESTADOS_USA} value={familiarEstadoUsa}
              onChange={(e) => setFamiliarEstadoUsa(e.target.value)}
              placeholder="Selecciona…" required error={errors.famEstadoUsa} />
          )}

          {familiarPais === 'OTRO' && (
            <>
              <Input label="¿Cuál país?" value={otroPaisFamiliar} onChange={(e) => setOtroPaisFamiliar(e.target.value)} required error={errors.otroPaisFam} placeholder="Escribe el nombre del país" />
              <Input label="Estado/Provincia" value={estadoOtroFamiliar} onChange={(e) => setEstadoOtroFamiliar(e.target.value)} required error={errors.estadoOtroFam} placeholder="Escribe el estado o provincia" />
            </>
          )}

          <StepNavigation currentStep={currentStep} totalSteps={TOTAL_STEPS} onPrev={handlePrev} onNext={handleNext} />
        </div>
      )}

      {/* PASO 6: Contacto de Emergencia */}
      {currentStep === 6 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <div className="mb-6">
            <h2 className="font-serif text-text-primary text-2xl font-semibold mb-2">
              Contacto de emergencia
            </h2>
            <p className="text-text-secondary text-sm">
              A quién contactamos si es necesario.
            </p>
          </div>

          <Input label="Nombre completo" value={emergenciaNombre} onChange={(e) => setEmergenciaNombre(e.target.value)} required error={errors.emNombre} />

          <div className="mb-5">
            <label className="block mb-2 font-medium text-text-secondary text-[0.95rem]">
              Parentesco
              <span className="text-secondary ml-1 font-bold">*</span>
            </label>
            <div className="flex gap-2">
              {[
                { value: 'Mamá', label: 'Mamá' },
                { value: 'Papá', label: 'Papá' },
                { value: 'otro', label: 'Otro' },
              ].map((opcion) => (
                <button
                  key={opcion.value}
                  type="button"
                  onClick={() => setEmergenciaParentesco(opcion.value)}
                  className={`flex-1 py-3 sm:py-3.5 rounded-xl font-medium border transition-all duration-300
                    ${emergenciaParentesco === opcion.value
                      ? 'bg-primary text-white border-transparent'
                      : 'bg-surface border-border-warm text-text-primary hover:border-primary-light'}`}
                >
                  {opcion.label}
                </button>
              ))}
            </div>
            {errors.emParentesco && (
              <span className="text-red-500 text-sm mt-1 block">{errors.emParentesco}</span>
            )}
          </div>

          {emergenciaParentesco === 'otro' && (
            <Input
              label="Especifica parentesco"
              value={emergenciaParentescoOtro}
              onChange={(e) => setEmergenciaParentescoOtro(e.target.value)}
              error={errors.emParentescoOtro}
            />
          )}

          <Input label="Teléfono" placeholder="10 dígitos" value={emergenciaTelefono} onChange={(e) => handlePhoneInput(e.target.value, setEmergenciaTelefono)} required inputMode="numeric" maxLength={10} error={errors.emTelefono} />

          <StepNavigation
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onPrev={handlePrev}
            onNext={handleNext}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Loading overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-[rgba(54,41,32,0.7)] backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface p-8 sm:p-12 rounded-3xl text-center shadow-2xl mx-5">
            <div className="w-14 h-14 border-4 border-primary-light border-t-primary rounded-full animate-spin mx-auto" />
            <p className="mt-5 text-text-primary font-medium text-lg">{submitStatus}</p>
            <p className="mt-2 text-text-secondary text-sm">Por favor espera, esto puede tardar unos segundos.</p>
          </div>
        </div>
      )}
    </form>
  );
}
