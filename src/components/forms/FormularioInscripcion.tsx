'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select, GroupedSelect, RadioGroup, FileInput } from '@/components/ui/FormFields';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { StepNavigation } from '@/components/ui/StepNavigation';
import { CURSOS_AGRUPADOS, CURSOS, ESTADOS_USA, FILE_CONFIG, ACADEMIA_INFO } from '@/lib/constants';
import { CatalogosAgrupados } from '@/types';

const TOTAL_STEPS = 6;

export default function FormularioInscripcion() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---- Estado del formulario ----
  // Paso 1: Aviso de privacidad
  const [aceptaAviso, setAceptaAviso] = useState(false);

  // Paso 2: Curso y documentos
  const [curso, setCurso] = useState('');
  const [ine, setIne] = useState<File | null>(null);
  const [actaNacimiento, setActaNacimiento] = useState<File | null>(null);
  const [comprobanteDomicilio, setComprobanteDomicilio] = useState<File | null>(null);

  // Paso 3: Datos personales
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
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

  // ---- Helpers ----
  const requiereDocumentos = CURSOS.find((c) => c.value === curso)?.requiereDocumentos ?? false;

  const estadosMexico = Object.keys(catalogos).sort().map((e) => ({ value: e, label: e }));

  const getMunicipios = (estado: string) =>
    (catalogos[estado] || []).map((m) => ({ value: m, label: m }));

  const paisesOptions = [
    { value: 'MEXICO', label: 'México' },
    { value: 'ESTADOS UNIDOS', label: 'Estados Unidos' },
    { value: 'OTRO', label: 'Otro país' },
  ];

  // Convertir cursos agrupados para el GroupedSelect
  const cursosParaSelect = Object.fromEntries(
    Object.entries(CURSOS_AGRUPADOS).map(([grupo, cursos]) => [
      grupo,
      cursos.map((c) => ({ value: c.value, label: c.label })),
    ])
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
        if (!curso) newErrors.curso = 'Selecciona un curso';
        if (requiereDocumentos) {
          if (!ine) newErrors.ine = 'La INE/CURP es obligatoria';
          if (!comprobanteDomicilio) newErrors.comprobante = 'El comprobante de domicilio es obligatorio';
          if (ine && !validateFile(ine, 'ine')) return false;
          if (actaNacimiento && !validateFile(actaNacimiento, 'acta')) return false;
          if (comprobanteDomicilio && !validateFile(comprobanteDomicilio, 'comprobante')) return false;
        }
        break;

      case 3:
        if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
        if (!apellidoPaterno.trim()) newErrors.apellidoPaterno = 'El apellido paterno es obligatorio';
        if (!apellidoMaterno.trim()) newErrors.apellidoMaterno = 'El apellido materno es obligatorio';
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
        if (!fechaNacimiento) newErrors.fechaNacimiento = 'Selecciona la fecha de nacimiento';
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
        if (!familiarTelefono.trim()) newErrors.famTelefono = 'El teléfono es obligatorio';
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
        if (!emergenciaTelefono.trim()) newErrors.emTelefono = 'El teléfono es obligatorio';
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

    try {
      const formData = new FormData();

      // Datos de texto
      formData.append('curso', curso);
      formData.append('nombre', nombre);
      formData.append('apellido_paterno', apellidoPaterno);
      formData.append('apellido_materno', apellidoMaterno);
      formData.append('telefono_celular', telefonoCelular);
      formData.append('correo_electronico', correo);
      formData.append('estado_civil', estadoCivil === 'otro' ? estadoCivilOtro : estadoCivil);
      formData.append('grado_estudios', gradoEstudios === 'otro' ? gradoEstudiosOtro : gradoEstudios);
      formData.append('fecha_nacimiento', fechaNacimiento);

      // País de nacimiento
      if (paisNacimiento === 'MEXICO') {
        formData.append('pais_nacimiento', 'MEXICO');
        formData.append('estado_nacimiento', estadoNacimientoMx);
        formData.append('municipio_nacimiento', municipioNacimiento);
      } else if (paisNacimiento === 'ESTADOS UNIDOS') {
        formData.append('pais_nacimiento', 'ESTADOS UNIDOS');
        formData.append('estado_nacimiento', estadoNacimientoUsa);
      } else if (paisNacimiento === 'OTRO') {
        formData.append('pais_nacimiento', otroPaisNacimiento);
        formData.append('lugar_nacimiento', lugarNacimiento);
      }

      // Domicilio
      formData.append('calle_domicilio', calleDomicilio);
      formData.append('numero_exterior', numeroExterior);
      if (numeroInterior) formData.append('numero_interior', numeroInterior);
      formData.append('colonia_domicilio', coloniaDomicilio);
      formData.append('codigo_postal', codigoPostal);

      if (paisDomicilio === 'MEXICO') {
        formData.append('pais_domicilio', 'MEXICO');
        formData.append('estado_domicilio', estadoDomicilioMx);
        formData.append('municipio_domicilio', municipioDomicilio);
      } else if (paisDomicilio === 'ESTADOS UNIDOS') {
        formData.append('pais_domicilio', 'ESTADOS UNIDOS');
        formData.append('estado_domicilio', estadoDomicilioUsa);
      } else if (paisDomicilio === 'OTRO') {
        formData.append('pais_domicilio', otroPaisDomicilio);
        formData.append('estado_domicilio', estadoOtroDomicilio);
      }

      // Familiar
      formData.append('familiar_nombre', familiarNombre);
      formData.append('familiar_parentesco', familiarParentesco === 'otro' ? familiarParentescoOtro : familiarParentesco);
      formData.append('familiar_telefono', familiarTelefono);
      formData.append('familiar_calle', familiarCalle);
      formData.append('familiar_numero', familiarNumero);
      formData.append('familiar_colonia', familiarColonia);
      formData.append('familiar_codigo_postal', familiarCp);

      if (familiarPais === 'MEXICO') {
        formData.append('familiar_pais', 'MEXICO');
        formData.append('familiar_estado', familiarEstadoMx);
        formData.append('familiar_municipio', familiarMunicipio);
      } else if (familiarPais === 'ESTADOS UNIDOS') {
        formData.append('familiar_pais', 'ESTADOS UNIDOS');
        formData.append('familiar_estado', familiarEstadoUsa);
      } else if (familiarPais === 'OTRO') {
        formData.append('familiar_pais', otroPaisFamiliar);
        formData.append('familiar_estado', estadoOtroFamiliar);
      }

      // Emergencia
      formData.append('emergencia_nombre', emergenciaNombre);
      formData.append('emergencia_parentesco', emergenciaParentesco === 'otro' ? emergenciaParentescoOtro : emergenciaParentesco);
      formData.append('emergencia_telefono', emergenciaTelefono);

      // Archivos
      if (ine) formData.append('ine', ine);
      if (actaNacimiento) formData.append('acta_nacimiento', actaNacimiento);
      if (comprobanteDomicilio) formData.append('comprobante_domicilio', comprobanteDomicilio);

      const response = await fetch('/api/registro', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/inscripcion/gracias?id=${result.registroId}`);
      } else {
        setErrors({ submit: result.error || 'Error al enviar el registro' });
      }
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
    <form onSubmit={handleSubmit} className="max-w-[680px] mx-auto bg-white rounded-3xl shadow-xl overflow-hidden animate-[fadeInUp_0.6s_ease]">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark px-5 py-6 sm:px-8 sm:py-9 text-center relative overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_60%)] pointer-events-none" />
        <h1 className="text-white text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 relative">
          Formulario de Inscripción
        </h1>
        <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Error general */}
      {errors.submit && (
        <div className="mx-5 sm:mx-8 mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-center">
          {errors.submit}
        </div>
      )}

      {/* PASO 1: Aviso de Privacidad */}
      {currentStep === 1 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <h2 className="text-gray-700 text-lg sm:text-xl font-semibold mb-4 sm:mb-5 flex items-center gap-2">
            🔒 Aviso de Privacidad
          </h2>
          <p className="text-gray-500 text-[0.95rem] mb-4 leading-relaxed">
            <strong>Academia Danas</strong>, con domicilio en {ACADEMIA_INFO.direccion}, es el
            responsable del uso y protección de sus datos personales.
          </p>
          <div className="space-y-3 my-5">
            <div className="p-3 px-4 pl-12 bg-gray-50 rounded-lg relative text-sm text-gray-500">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[0.65rem] font-bold">✓</span>
              Para llevar a cabo la inscripción del alumno en nuestro sistema de control escolar.
            </div>
            <div className="p-3 px-4 pl-12 bg-gray-50 rounded-lg relative text-sm text-gray-500">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[0.65rem] font-bold">✓</span>
              Trámite de registro ante el Instituto de Formación para el Trabajo del Estado de Jalisco (IDEFT).
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-6">
            Para conocer mayor información, consulta el aviso de privacidad en:{' '}
            <a href={ACADEMIA_INFO.website} target="_blank" className="text-primary font-medium hover:underline">
              {ACADEMIA_INFO.website}
            </a>
          </p>

          <label
            className={`flex items-start gap-3 p-4 sm:p-5 rounded-xl border-2 cursor-pointer transition-all
              ${aceptaAviso ? 'bg-primary-50 border-primary' : 'bg-gray-50 border-gray-200 hover:border-primary'}`}
          >
            <input
              type="checkbox"
              checked={aceptaAviso}
              onChange={(e) => setAceptaAviso(e.target.checked)}
              className="w-5 h-5 accent-primary mt-0.5 flex-shrink-0"
            />
            <span className="text-[0.95rem]">
              He leído y acepto el Aviso de Privacidad.
              <span className="text-primary font-bold ml-1">*</span>
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
          />
        </div>
      )}

      {/* PASO 2: Curso y Documentos */}
      {currentStep === 2 && (
        <div className="p-5 pt-6 sm:p-8 sm:pt-9 animate-[fadeIn_0.4s_ease]">
          <h2 className="text-gray-700 text-lg sm:text-xl font-semibold mb-4 sm:mb-6 pb-3 border-b-[3px] border-primary-light flex items-center gap-2">
            <span className="w-2 h-7 bg-gradient-to-b from-primary to-primary-dark rounded" />
            Curso y Documentos
          </h2>

          <GroupedSelect
            label="Curso de Interés"
            groups={cursosParaSelect}
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            placeholder="-- Selecciona un curso --"
            required
            error={errors.curso}
          />

          {curso && requiereDocumentos && (
            <div className="animate-[fadeIn_0.3s_ease]">
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-xl mb-6">
                <p className="text-orange-800 text-sm">
                  📄 <strong>Este curso requiere documentos.</strong> Por favor sube los siguientes archivos:
                </p>
              </div>

              <FileInput
                label="INE (PDF o Imagen)"
                name="ine"
                nota="Si eres menor de edad, sube tu CURP"
                required
                onChange={setIne}
                fileName={ine?.name}
                error={errors.ine}
              />

              <FileInput
                label="Acta de Nacimiento (PDF o Imagen)"
                name="acta_nacimiento"
                nota="Solo aplica para menores de 18 años"
                onChange={setActaNacimiento}
                fileName={actaNacimiento?.name}
                error={errors.acta}
              />

              <FileInput
                label="Comprobante de Domicilio (PDF o Imagen)"
                name="comprobante_domicilio"
                required
                onChange={setComprobanteDomicilio}
                fileName={comprobanteDomicilio?.name}
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
          <h2 className="text-gray-700 text-lg sm:text-xl font-semibold mb-4 sm:mb-6 pb-3 border-b-[3px] border-primary-light flex items-center gap-2">
            <span className="w-2 h-7 bg-gradient-to-b from-primary to-primary-dark rounded" />
            Datos Personales
          </h2>

          <Input label="Nombre(s)" value={nombre} onChange={(e) => setNombre(e.target.value)} required error={errors.nombre} />
          <Input label="Apellido Paterno" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} required error={errors.apellidoPaterno} />
          <Input label="Apellido Materno" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} required error={errors.apellidoMaterno} />
          <Input label="Teléfono Celular" value={telefonoCelular} onChange={(e) => handlePhoneInput(e.target.value, setTelefonoCelular)} required inputMode="numeric" maxLength={10} error={errors.telefono} />
          <Input label="Correo Electrónico" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required error={errors.correo} />

          <RadioGroup
            label="Estado Civil"
            name="estado_civil"
            options={[
              { value: 'Soltera(o)', label: 'Soltera(o)' },
              { value: 'Casada(o)', label: 'Casada(o)' },
              { value: 'otro', label: 'Otro:', hasOtherInput: true },
            ]}
            value={estadoCivil}
            otherValue={estadoCivilOtro}
            onChange={setEstadoCivil}
            onOtherChange={setEstadoCivilOtro}
            required
            error={errors.estadoCivil || errors.estadoCivilOtro}
          />

          <RadioGroup
            label="Último Grado de Estudios"
            name="grado_estudios"
            options={[
              { value: 'Primaria', label: 'Primaria' },
              { value: 'Secundaria', label: 'Secundaria' },
              { value: 'Preparatoria', label: 'Preparatoria' },
              { value: 'Licenciatura', label: 'Licenciatura' },
              { value: 'otro', label: 'Otro:', hasOtherInput: true },
            ]}
            value={gradoEstudios}
            otherValue={gradoEstudiosOtro}
            onChange={setGradoEstudios}
            onOtherChange={setGradoEstudiosOtro}
            required
            error={errors.gradoEstudios || errors.gradoEstudiosOtro}
          />

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
          <h2 className="text-gray-700 text-lg sm:text-xl font-semibold mb-4 sm:mb-6 pb-3 border-b-[3px] border-primary-light flex items-center gap-2">
            <span className="w-2 h-7 bg-gradient-to-b from-primary to-primary-dark rounded" />
            Domicilio
          </h2>

          <Input label="Calle" value={calleDomicilio} onChange={(e) => setCalleDomicilio(e.target.value)} required error={errors.calle} />
          <Input label="Número Exterior" value={numeroExterior} onChange={(e) => setNumeroExterior(e.target.value)} required error={errors.numExt} />
          <Input label="Número Interior (opcional)" value={numeroInterior} onChange={(e) => setNumeroInterior(e.target.value)} />
          <Input label="Colonia / Localidad" value={coloniaDomicilio} onChange={(e) => setColoniaDomicilio(e.target.value)} required error={errors.colonia} />
          <Input label="Código Postal" value={codigoPostal} onChange={(e) => handleCpInput(e.target.value, setCodigoPostal)} required inputMode="numeric" maxLength={5} error={errors.cp} />

          <Select label="País" options={paisesOptions} value={paisDomicilio}
            onChange={(e) => {
              setPaisDomicilio(e.target.value);
              setEstadoDomicilioMx(''); setMunicipioDomicilio('');
              setEstadoDomicilioUsa(''); setOtroPaisDomicilio(''); setEstadoOtroDomicilio('');
            }}
            placeholder="-- Selecciona un país --" required error={errors.paisDom} />

          {paisDomicilio === 'MEXICO' && (
            <>
              <Select label="Estado" options={estadosMexico} value={estadoDomicilioMx}
                onChange={(e) => { setEstadoDomicilioMx(e.target.value); setMunicipioDomicilio(''); }}
                placeholder="-- Selecciona un estado --" required error={errors.estadoDom} />
              <Select label="Municipio" options={getMunicipios(estadoDomicilioMx)} value={municipioDomicilio}
                onChange={(e) => setMunicipioDomicilio(e.target.value)}
                placeholder={estadoDomicilioMx ? '-- Selecciona un municipio --' : '-- Primero selecciona un estado --'}
                required error={errors.municipioDom} />
            </>
          )}

          {paisDomicilio === 'ESTADOS UNIDOS' && (
            <Select label="Estado" options={ESTADOS_USA} value={estadoDomicilioUsa}
              onChange={(e) => setEstadoDomicilioUsa(e.target.value)}
              placeholder="-- Selecciona un estado --" required error={errors.estadoDomUsa} />
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
          <h2 className="text-gray-700 text-lg sm:text-xl font-semibold mb-4 sm:mb-6 pb-3 border-b-[3px] border-primary-light flex items-center gap-2">
            <span className="w-2 h-7 bg-gradient-to-b from-primary to-primary-dark rounded" />
            Contacto Familiar
          </h2>

          <Input label="Nombre Completo del Familiar" value={familiarNombre} onChange={(e) => setFamiliarNombre(e.target.value)} required error={errors.famNombre} />

          <RadioGroup
            label="Parentesco"
            name="familiar_parentesco"
            options={[
              { value: 'Mamá', label: 'Mamá' },
              { value: 'Papá', label: 'Papá' },
              { value: 'otro', label: 'Otro:', hasOtherInput: true },
            ]}
            value={familiarParentesco}
            otherValue={familiarParentescoOtro}
            onChange={setFamiliarParentesco}
            onOtherChange={setFamiliarParentescoOtro}
            required
            error={errors.famParentesco || errors.famParentescoOtro}
          />

          <Input label="Teléfono" value={familiarTelefono} onChange={(e) => handlePhoneInput(e.target.value, setFamiliarTelefono)} required inputMode="numeric" maxLength={10} error={errors.famTelefono} />
          <Input label="Calle" value={familiarCalle} onChange={(e) => setFamiliarCalle(e.target.value)} required error={errors.famCalle} />
          <Input label="Número Exterior" value={familiarNumero} onChange={(e) => setFamiliarNumero(e.target.value)} required error={errors.famNumero} />
          <Input label="Colonia / Localidad" value={familiarColonia} onChange={(e) => setFamiliarColonia(e.target.value)} required error={errors.famColonia} />
          <Input label="Código Postal" value={familiarCp} onChange={(e) => handleCpInput(e.target.value, setFamiliarCp)} required inputMode="numeric" maxLength={5} error={errors.famCp} />

          <Select label="País" options={paisesOptions} value={familiarPais}
            onChange={(e) => {
              setFamiliarPais(e.target.value);
              setFamiliarEstadoMx(''); setFamiliarMunicipio('');
              setFamiliarEstadoUsa(''); setOtroPaisFamiliar(''); setEstadoOtroFamiliar('');
            }}
            placeholder="-- Selecciona un país --" required error={errors.famPais} />

          {familiarPais === 'MEXICO' && (
            <>
              <Select label="Estado" options={estadosMexico} value={familiarEstadoMx}
                onChange={(e) => { setFamiliarEstadoMx(e.target.value); setFamiliarMunicipio(''); }}
                placeholder="-- Selecciona un estado --" required error={errors.famEstado} />
              <Select label="Municipio" options={getMunicipios(familiarEstadoMx)} value={familiarMunicipio}
                onChange={(e) => setFamiliarMunicipio(e.target.value)}
                placeholder={familiarEstadoMx ? '-- Selecciona un municipio --' : '-- Primero selecciona un estado --'}
                required error={errors.famMunicipio} />
            </>
          )}

          {familiarPais === 'ESTADOS UNIDOS' && (
            <Select label="Estado" options={ESTADOS_USA} value={familiarEstadoUsa}
              onChange={(e) => setFamiliarEstadoUsa(e.target.value)}
              placeholder="-- Selecciona un estado --" required error={errors.famEstadoUsa} />
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
          <h2 className="text-gray-700 text-lg sm:text-xl font-semibold mb-4 sm:mb-6 pb-3 border-b-[3px] border-primary-light flex items-center gap-2">
            <span className="w-2 h-7 bg-gradient-to-b from-primary to-primary-dark rounded" />
            Contacto de Emergencia
          </h2>

          <Input label="Nombre Completo" value={emergenciaNombre} onChange={(e) => setEmergenciaNombre(e.target.value)} required error={errors.emNombre} />

          <RadioGroup
            label="Parentesco"
            name="emergencia_parentesco"
            options={[
              { value: 'Mamá', label: 'Mamá' },
              { value: 'Papá', label: 'Papá' },
              { value: 'otro', label: 'Otro:', hasOtherInput: true },
            ]}
            value={emergenciaParentesco}
            otherValue={emergenciaParentescoOtro}
            onChange={setEmergenciaParentesco}
            onOtherChange={setEmergenciaParentescoOtro}
            required
            error={errors.emParentesco || errors.emParentescoOtro}
          />

          <Input label="Teléfono" value={emergenciaTelefono} onChange={(e) => handlePhoneInput(e.target.value, setEmergenciaTelefono)} required inputMode="numeric" maxLength={10} error={errors.emTelefono} />

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
        <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 sm:p-12 rounded-3xl text-center shadow-2xl mx-5">
            <div className="w-14 h-14 border-4 border-primary-light border-t-primary rounded-full animate-spin mx-auto" />
            <p className="mt-5 text-gray-800 font-medium text-lg">Enviando registro...</p>
            <p className="mt-2 text-gray-500 text-sm">Por favor espera, esto puede tardar unos segundos.</p>
          </div>
        </div>
      )}
    </form>
  );
}
