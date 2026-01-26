// Importamos el tipo 'Metadata' de Next.js para definir los metadatos de la página.
import type {Metadata} from 'next';
// Importamos el archivo de estilos globales.
import './globals.css';
// Importamos el componente 'Toaster' para mostrar notificaciones emergentes.
import { Toaster } from "@/components/ui/toaster";

// 'metadata' es un objeto especial que Next.js usa para configurar el <head> del HTML.
// Aquí definimos el título y la descripción que aparecerán en la pestaña del navegador y en los resultados de búsqueda. 
export const metadata: Metadata = {
  title: 'Credipep - Panel de Administración',
  description: 'Panel de administración para Credipep',
};

// Esta es la función principal del Layout raíz. Envuelve toda la aplicación.
// Recibe 'children', que representa cualquier página o componente que se esté renderizando.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // La función devuelve la estructura HTML básica de la aplicación.
  return (
    <html lang="es">
      <head>
        {/* Nos conectamos a Google Fonts para cargar las tipografías que usaremos. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      {/* En el body, aplicamos una clase para la tipografía base. */}
      <body className="font-body antialiased
      suppressHydrationWarning={true}">
        {/* Aquí se renderizará el contenido de la página actual. */}
        {children}
        {/* 'Toaster' se coloca aquí para que las notificaciones puedan aparecer en cualquier parte de la aplicación. */}
        <Toaster />
      </body>
    </html>
  );
}
