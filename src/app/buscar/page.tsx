'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ACADEMIA_INFO } from '@/lib/constants';

interface SearchResult {
  found: boolean;
  id?: number;
  nombre?: string;
  curso?: string;
  fecha?: string;
  message?: string;
}

export default function BuscarPage() {
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!correo.trim() || !telefono.trim()) {
      setError('Ingresa tu correo electrónico y teléfono celular.');
      return;
    }

    if (telefono.length !== 10) {
      setError('El teléfono debe ser de 10 dígitos.');
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch('/api/registro/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correo.trim(), telefono: telefono.trim() }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError('Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setIsSearching(false);
    }
  }

  function formatDate(dateStr: string) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-pink-50 flex items-center justify-center p-5">
      <div className="max-w-[500px] w-full">
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
          <h1 className="text-xl font-semibold text-gray-700 mb-3">
            🔍 Buscar mi Comprobante
          </h1>

          <p className="text-gray-500 text-sm mb-8">
            Ingresa tu correo electrónico y teléfono celular para encontrar tu registro.
          </p>

          <form onSubmit={handleSearch} className="text-left">
            <div className="mb-5">
              <label className="block mb-2 font-medium text-gray-800 text-[0.95rem]">
                Correo Electrónico <span className="text-primary font-bold">*</span>
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base
                  hover:border-primary-light focus:outline-none focus:border-primary
                  focus:shadow-[0_0_0_4px_rgba(231,74,130,0.08)] transition-all"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 font-medium text-gray-800 text-[0.95rem]">
                Teléfono Celular <span className="text-primary font-bold">*</span>
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 dígitos"
                inputMode="numeric"
                maxLength={10}
                required
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base
                  hover:border-primary-light focus:outline-none focus:border-primary
                  focus:shadow-[0_0_0_4px_rgba(231,74,130,0.08)] transition-all"
              />
            </div>

            {error && (
              <div className="mb-5 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSearching}
              className="w-full py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl
                font-semibold shadow-[0_4px_15px_rgba(231,74,130,0.35)]
                hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(231,74,130,0.45)]
                transition-all disabled:opacity-50 disabled:hover:translate-y-0
                flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Buscando...
                </>
              ) : (
                'Buscar Registro'
              )}
            </button>
          </form>

          {/* Resultado encontrado */}
          {result?.found && (
            <div className="mt-8 animate-[fadeIn_0.4s_ease]">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-left">
                <h3 className="text-green-800 font-semibold text-lg mb-4 text-center">
                  ✅ ¡Registro encontrado!
                </h3>

                <div className="space-y-2 text-sm">
                  <p className="text-gray-700">
                    <strong>Folio:</strong> #{result.id}
                  </p>
                  <p className="text-gray-700">
                    <strong>Nombre:</strong> {result.nombre}
                  </p>
                  <p className="text-gray-700">
                    <strong>Curso:</strong> {result.curso}
                  </p>
                  <p className="text-gray-700">
                    <strong>Fecha de registro:</strong> {formatDate(result.fecha!)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No encontrado */}
          {result && !result.found && (
            <div className="mt-8 animate-[fadeIn_0.4s_ease]">
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 text-center">
                <p className="text-orange-800 font-medium">
                  😕 {result.message}
                </p>
                <p className="text-orange-600 text-sm mt-2">
                  Verifica que el correo y teléfono sean los que usaste al registrarte.
                </p>
              </div>
            </div>
          )}

          <Link
            href="/"
            className="inline-block mt-8 text-primary font-medium hover:text-primary-dark hover:underline transition-all"
          >
            ← Volver a la página principal
          </Link>
        </div>
      </div>
    </main>
  );
}
