import FormularioInscripcion from '@/components/forms/FormularioInscripcion';

export const metadata = {
  title: 'Inscripción - Academia Danas',
  description: 'Formulario de inscripción para Academia Danas',
};

export default function InscripcionPage() {
  return (
    <main className="min-h-screen bg-cream py-5 px-4">
      <FormularioInscripcion />
    </main>
  );
}
