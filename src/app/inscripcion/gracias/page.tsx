'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ACADEMIA_INFO } from '@/lib/constants';

function GraciasContent() {
  const searchParams = useSearchParams();
  const registroId = searchParams.get('id');

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-pink-50 flex items-center justify-center p-5">
      <div className="max-w-[600px] w-full">
        <div className="text-center mb-6">
          <Image
            src={ACADEMIA_INFO.logo}
            alt="Academia Danas"
            width={160}
            height={80}
            className="mx-auto drop-shadow-md"
            priority
          />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-10 text-center animate-[fadeInUp_0.6s_ease]">
          <h1 className="text-2xl font-semibold text-primary mb-6 flex items-center justify-center gap-3">
            🎉 ¡Registro Enviado Exitosamente!
          </h1>

          <p className="text-gray-500 mb-3 leading-relaxed">
            Gracias por registrarte en <strong>Academia Dana&apos;s</strong>.
          </p>

          <p className="text-gray-500 mb-6">
            Hemos recibido tus datos y documentos correctamente.
          </p>

          {registroId && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 mb-6">
              <p className="text-green-800 font-bold text-lg">
                📋 Tu número de folio es: #{registroId}
              </p>
            </div>
          )}

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-6">
            <p className="text-blue-800 text-sm">
              📧 En breve recibirás un correo electrónico con tu comprobante de inscripción.
              Revisa tu bandeja de entrada y carpeta de spam.
            </p>
          </div>

          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5 mb-8">
            <p className="text-orange-800 text-sm">
              📱 Si tienes alguna duda, contáctanos por WhatsApp al{' '}
              <strong>{ACADEMIA_INFO.telefono}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full bg-gradient-to-r from-primary to-primary-dark text-white py-4 px-6 rounded-xl
                font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all text-center"
            >
              Volver a la página principal
            </Link>

            <Link
              href="/buscar"
              className="block w-full bg-gray-100 text-gray-600 py-4 px-6 rounded-xl
                font-semibold border-2 border-gray-200 hover:bg-gray-200 transition-all text-center"
            >
              🔍 Buscar mi comprobante
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function GraciasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <GraciasContent />
    </Suspense>
  );
}
