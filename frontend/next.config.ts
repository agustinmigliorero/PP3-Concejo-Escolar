import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["92.113.39.212"],
  // SEC-02 (defensa adicional): la app no usa next/image, así que se desactiva
  // el optimizador. Con `unoptimized: true` el endpoint /_next/image responde
  // 404 y deja de exponer la superficie de ataque del optimizador de imágenes.
  // Si en el futuro se incorpora next/image, revisar esta opción.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
