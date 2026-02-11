import Image from 'next/image';
import { ACADEMIA_INFO } from '@/lib/constants';
import FormularioInscripcion from '@/components/forms/FormularioInscripcion';

export const metadata = {
  title: 'Inscripción - Academia Danas',
  description: 'Formulario de inscripción para Academia Danas',
};

export default function InscripcionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-pink-50 py-5 px-4">
      <div className="text-center mb-6">
        <Image
          src={ACADEMIA_INFO.logo}
          alt="Academia Danas"
          width={160}
          height={80}
          className="mx-auto drop-shadow-md hover:scale-105 transition-transform duration-300"
          priority
        />
      </div>

      <FormularioInscripcion />
    </main>
  );
}
