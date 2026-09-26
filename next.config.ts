import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Sortie autonome : l'image Docker n'embarque que le serveur et ses
  // dépendances réellement utilisées (voir Dockerfile).
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
