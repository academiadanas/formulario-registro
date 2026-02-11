'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { ACADEMIA_INFO } from '@/lib/constants';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center p-5">
      <div className="max-w-[420px] w-full">
        <div className="text-center mb-6">
          <Image
            src={ACADEMIA_INFO.logo}
            alt="Academia Danas"
            width={140}
            height={70}
            className="mx-auto drop-shadow-lg"
            priority
          />
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-10 animate-[fadeInUp_0.6s_ease]">
          <h1 className="text-xl font-semibold text-gray-700 mb-2 text-center">
            🔐 Panel Administrativo
          </h1>
          <p className="text-gray-400 text-sm mb-8 text-center">
            Acceso exclusivo para personal autorizado
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block mb-2 font-medium text-gray-700 text-sm">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base
                  hover:border-gray-300 focus:outline-none focus:border-primary
                  focus:shadow-[0_0_0_4px_rgba(231,74,130,0.08)] transition-all"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 font-medium text-gray-700 text-sm">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base
                  hover:border-gray-300 focus:outline-none focus:border-primary
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
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl
                font-semibold shadow-[0_4px_15px_rgba(231,74,130,0.35)]
                hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(231,74,130,0.45)]
                transition-all disabled:opacity-50 disabled:hover:translate-y-0
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
