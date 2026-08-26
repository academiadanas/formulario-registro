import type { Metadata } from 'next';
import { Spectral, Karla } from 'next/font/google';
import './globals.css';

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Academia Danas - Inscripción',
  description:
    'Sistema de inscripción en línea para Academia Danas. Regístrate en nuestros diplomados y cursos de cosmetología.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${spectral.variable} ${karla.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
