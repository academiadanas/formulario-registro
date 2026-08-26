'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { WizardHeader } from '@/components/ui/WizardHeader';

interface PDFResult {
  success: boolean;
  emailSent: boolean;
  emailError?: string;
  correoEnviado?: string;
  error?: string;
}

function GraciasContent() {
  const searchParams = useSearchParams();
  const registroId = searchParams.get('id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<PDFResult | null>(null);

  // Evita el fetch duplicado del doble-montaje de Strict Mode en desarrollo
  // (el servidor ya es idempotente vía contrato_enviado_at de todos modos).
  const enviadoRef = useRef(false);

  useEffect(() => {
    if (!registroId) {
      setStatus('error');
      return;
    }

    if (enviadoRef.current) return;
    enviadoRef.current = true;

    // Enviar correo automáticamente
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
    <main className="min-h-screen bg-cream flex items-center justify-center p-5">
      <div className="max-w-[600px] w-full">
        <div className="bg-surface rounded-3xl shadow-xl overflow-hidden animate-[fadeInUp_0.6s_ease]">
          <WizardHeader title="Confirmación" currentStep={7} totalSteps={7} />

          <div className="p-6 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">✓</span>
          </div>

          <h1 className="font-serif text-xl sm:text-2xl font-semibold text-text-primary mb-4 sm:mb-6 flex items-center justify-center gap-2 sm:gap-3">
            ¡Registro enviado!
          </h1>

          <p className="text-text-secondary mb-3">
            Gracias por registrarte en <strong className="whitespace-nowrap">Academia Dana&apos;s</strong>.
          </p>

          <p className="text-text-secondary mb-6">
            Hemos recibido tus datos y documentos correctamente.
          </p>

          {registroId && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 mb-6">
              <p className="text-green-800 font-bold text-lg">
                Tu número de folio es: #{registroId}
              </p>
            </div>
          )}

          {/* Estado del correo */}
          {status === 'loading' && (
            <div className="my-6 animate-[fadeIn_0.4s_ease]">
              <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-text-secondary text-sm">Enviando correo de confirmación...</p>
              <p className="mt-1 text-text-secondary text-xs">Esto puede tardar unos segundos</p>
            </div>
          )}

          {status === 'success' && result && (
            <div className="animate-[fadeIn_0.4s_ease] space-y-4">
              {/* Correo enviado */}
              {result.emailSent && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                  <p className="text-green-800 font-semibold mb-2">¡Correo enviado!</p>
                  <p className="text-green-700 text-sm">
                    Se envió a: <strong>{result.correoEnviado}</strong>
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    Revisa tu bandeja de entrada o carpeta de spam.
                  </p>
                </div>
              )}

              {/* Correo no enviado */}
              {!result.emailSent && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5">
                  <p className="text-orange-800 font-semibold mb-2">Registro guardado</p>
                  <p className="text-orange-700 text-sm">
                    {result.emailError || 'El correo no pudo ser enviado.'}
                  </p>
                </div>
              )}

              {/* Enlace al contrato */}
              <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5 mt-4">
                <p className="text-text-secondary text-sm mb-3">
                  Te invitamos a leer el <strong>Contrato de Prestación de Servicios Educativos</strong> antes de tu primer día de clases:
                </p>
                <a
                  href="https://www.academiadanas.com/contrato-servicios-educativos"
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 bg-secondary
                    text-white py-3 px-6 rounded-xl font-semibold hover:bg-secondary-dark transition-colors"
                >
                  Ver Contrato de Servicios Educativos
                </a>
              </div>
            </div>
          )}

          {status === 'error' && !result?.success && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 my-6">
              <p className="text-red-800 font-semibold mb-2">Error</p>
              <p className="text-red-700 text-sm">
                {result?.error || 'No se pudo enviar el correo de confirmación.'}
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
                  Reintentar
                </button>
              )}
            </div>
          )}

          {/* Texto legal */}
          <div className="mt-6 bg-surface-muted border border-border-warm rounded-xl p-4">
            <p className="text-text-secondary text-xs leading-relaxed">
              Al completar tu registro, confirmas haber recibido el enlace al{' '}
              <a href="https://www.academiadanas.com/contrato-servicios-educativos" target="_blank" className="text-secondary underline">
                Contrato de Prestación de Servicios Educativos
              </a>
              , así como los{' '}
              <a href="https://www.academiadanas.com/terminos-condiciones" target="_blank" className="text-secondary underline">
                Términos y Condiciones
              </a>{' '}
              y el{' '}
              <a href="https://www.academiadanas.com/aviso-privacidad" target="_blank" className="text-secondary underline">
                Aviso de Privacidad
              </a>
              .
            </p>
          </div>

          {/* Links */}
          <div className="mt-8 space-y-3">
            <Link
              href="/"
              className="block w-full bg-surface-muted text-text-secondary py-4 px-6 rounded-xl
                font-semibold border-2 border-border-warm hover:bg-border-warm transition-all text-center"
            >
              Volver a la página principal
            </Link>
          </div>
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
