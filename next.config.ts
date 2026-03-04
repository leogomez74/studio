import type { NextConfig } from 'next';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api';

const nextConfig: NextConfig = {
  /* Config options */

  // Ignorar errores de compilación durante el build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Permitir imágenes remotas de estas fuentes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Redirección de llamadas API locales al backend Laravel
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_API_URL}/:path*`,
      },
      // Servir archivos HTML estáticos sin extensión
      {
        source: '/registro',
        destination: '/registro/index.html',
      },
      {
        source: '/cuestionario/publico',
        destination: '/cuestionario/publico/index.html',
      },
      {
        source: '/cuestionario/privado',
        destination: '/cuestionario/privado/index.html',
      },
      {
        source: '/cuestionario/pensionados',
        destination: '/cuestionario/pensionados/index.html',
      },
      {
        source: '/cuestionario/propio',
        destination: '/cuestionario/propio/index.html',
      },
    ];
  },
};

export default nextConfig;
