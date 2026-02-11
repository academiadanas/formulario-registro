'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ACADEMIA_INFO } from '@/lib/constants';

interface PDFResult {
  success: boolean;
  emailSent: boolean;
  emailError?: string;
  correoEnviado?: string;
  whatsappLink?: string;
  pdfFileName?: string;
  error?: string;
}

function GraciasContent() {
  const searchParams = useSearchParams();
  const registroId = searchParams.get('id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<PDFResult | null>(null);

  useEffect(() => {
    if (!registroId) {
      setStatus('error');
      return;
    }

    // Generar PDF y enviar correo automáticamente
    fetch(`/api/pdf/${registroId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send' }),
    })
      .then((res) => res.json())
      .then((data) => {
        setResult(data);
        setStatus(data.success ? 'success' : 'error');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [registroId]);

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

          <p className="text-gray-500 mb-3">
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

          {/* Estado del PDF y correo */}
          {status === 'loading' && (
            <div className="my-6 animate-[fadeIn_0.4s_ease]">
              <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-gray-500 text-sm">Generando y enviando tu comprobante...</p>
              <p className="mt-1 text-gray-400 text-xs">Esto puede tardar unos segundos</p>
            </div>
          )}

          {status === 'success' && result && (
            <div className="animate-[fadeIn_0.4s_ease] space-y-4">
              {/* Correo enviado */}
              {result.emailSent && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                  <p className="text-green-800 font-semibold mb-2">✅ ¡Comprobante enviado!</p>
                  <p className="text-green-700 text-sm">
                    📧 Correo enviado a: <strong>{result.correoEnviado}</strong>
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    Revisa tu bandeja de entrada y carpeta de spam.
                  </p>
                </div>
              )}

              {/* Correo no enviado pero PDF generado */}
              {!result.emailSent && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5">
                  <p className="text-orange-800 font-semibold mb-2">⚠️ PDF generado</p>
                  <p className="text-orange-700 text-sm">
                    {result.emailError || 'El correo no pudo ser enviado, pero puedes descargar tu comprobante.'}
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <a
                  href={`/api/pdf/${registroId}`}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-dark
                    text-white py-3 px-6 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
                >
                  📄 Ver PDF
                </a>

                {result.whatsappLink && (
                  <a
                    href={result.whatsappLink}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-2 bg-[#25d366] text-white
                      py-3 px-6 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
                  >
                    📱 Enviar por WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          {status === 'error' && !result?.success && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 my-6">
              <p className="text-red-800 font-semibold mb-2">❌ Error</p>
              <p className="text-red-700 text-sm">
                {result?.error || 'No se pudo generar el comprobante.'}
              </p>
              {registroId && (
                <button
                  onClick={() => {
                    setStatus('loading');
                    fetch(`/api/pdf/${registroId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'send' }),
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        setResult(data);
                        setStatus(data.success ? 'success' : 'error');
                      })
                      .catch(() => setStatus('error'));
                  }}
                  className="mt-4 bg-primary text-white px-6 py-2 rounded-lg font-semibold
                    hover:bg-primary-dark transition-all text-sm"
                >
                  🔄 Reintentar
                </button>
              )}
            </div>
          )}

          {/* Links */}
          <div className="mt-8 space-y-3">
            <Link
              href="/"
              className="block w-full bg-gray-100 text-gray-600 py-4 px-6 rounded-xl
                font-semibold border-2 border-gray-200 hover:bg-gray-200 transition-all text-center"
            >
              Volver a la página principal
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
