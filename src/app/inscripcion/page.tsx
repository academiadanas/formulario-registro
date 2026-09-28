import FormularioInscripcion from '@/components/forms/FormularioInscripcion';

import type { Metadata } from 'next';

// Solo el segmento: el sufijo " | Academia Danas" lo agrega el template del layout raíz.
// Se usa "Formulario de inscripción" y no "Inscripción" para no duplicar el título de la raíz.
export const metadata: Metadata = {
  title: 'Formulario de inscripción',
  description: 'Formulario de inscripción para Academia Danas',
};

export default function InscripcionPage() {
  return (
    <main className="min-h-screen bg-cream py-5 px-4">
      <FormularioInscripcion />
    </main>
  );
}
