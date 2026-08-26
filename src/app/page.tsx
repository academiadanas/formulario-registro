import Link from 'next/link';
import Image from 'next/image';
import { ACADEMIA_INFO } from '@/lib/constants';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-5">
      <div className="max-w-lg w-full bg-surface rounded-3xl shadow-xl p-6 sm:p-10 text-center">
        <Image
          src={ACADEMIA_INFO.logo}
          alt="Academia Danas"
          width={160}
          height={80}
          className="mx-auto mb-8"
          priority
        />

        <h1 className="font-serif text-2xl font-semibold text-text-primary mb-3">
          Bienvenido(a) a {ACADEMIA_INFO.nombre}
        </h1>

        <div className="space-y-4">
          <Link
            href="/inscripcion"
            className="block w-full bg-primary text-white py-4 px-6 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            📝 Formulario de Inscripción
          </Link>
        </div>

        <p className="mt-8 text-sm text-text-secondary">
          {ACADEMIA_INFO.direccion}
        </p>
      </div>
    </main>
  );
}
