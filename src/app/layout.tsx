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

const SITE_URL = 'https://inscripcion.academiadanas.com';
// Título de pestaña: patrón común de Sistema Danas ("<sección> | Academia Danas").
// Cada página hija declara solo su segmento; el sufijo lo pone el template.
const SITE_TITLE_DEFAULT = 'Inscripción | Academia Danas';
const SITE_TITLE_TEMPLATE = '%s | Academia Danas';
// Título social (og:title / twitter:title): marca primero, sin template.
const SOCIAL_TITLE = 'Academia Danas — Inscripción';
const SITE_DESCRIPTION =
  'Sistema de inscripción en línea para Academia Danas. Regístrate en nuestros diplomados y cursos de cosmetología.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: SITE_TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SOCIAL_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'Academia Danas',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SOCIAL_TITLE,
    description: SITE_DESCRIPTION,
  },
  // Las imágenes og:image / twitter:image las genera Next.js a partir de
  // src/app/opengraph-image.png (convención de archivo). No declararlas aquí.
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
