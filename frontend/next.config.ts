import type { NextConfig } from "next";

// ENVIRONMENT es el modo de transporte del despliegue; NODE_ENV tambien es
// production en builds HTTP durante la transicion y no sirve para decidir HSTS.
const httpsProduction = process.env.ENVIRONMENT === "production";
if (httpsProduction) {
  const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "");
  if (apiUrl.protocol !== "https:") {
    throw new Error("En production NEXT_PUBLIC_API_URL debe usar HTTPS");
  }
}

const nextConfig: NextConfig = {
  async headers() {
    return httpsProduction
      ? [{
          source: "/:path*",
          headers: [{
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          }],
        }]
      : [];
  },
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
