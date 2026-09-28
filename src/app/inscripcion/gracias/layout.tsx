import type { Metadata } from 'next';

// page.tsx de esta ruta es un componente cliente ('use client') y no puede
// exportar metadata. Este layout solo aporta el título de la pestaña; el
// sufijo " | Academia Danas" lo agrega el template del layout raíz.
export const metadata: Metadata = {
  title: 'Gracias',
};

export default function GraciasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
