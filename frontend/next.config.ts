import type { NextConfig } from "next";

// URL de la API, misma fuente que usa frontend/lib/api.ts. Va en connect-src
// de la CSP para que el navegador permita las llamadas al backend.
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Cabeceras que se aplican tanto en desarrollo como en producción.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// CSP del informe de seguridad. Se aplica SOLO en producción: en desarrollo
// rompe el hot reload (el websocket de HMR no está cubierto por
// connect-src 'self') y el eval-source-map de webpack (`npm run dev -- --webpack`).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${api}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// ENVIRONMENT es el modo de transporte del despliegue; NODE_ENV también es
// production en builds HTTP durante la transición y no sirve para decidir HSTS.
const httpsProduction = process.env.ENVIRONMENT === "production";
if (httpsProduction) {
  const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "");
  if (apiUrl.protocol !== "https:") {
    throw new Error("En production NEXT_PUBLIC_API_URL debe usar HTTPS");
  }
}

const nextConfig: NextConfig = {
  // No anunciar la tecnología del servidor.
  poweredByHeader: false,
  allowedDevOrigins: ["92.113.39.212"],
  // SEC-02 (defensa adicional): la app no usa next/image, así que se desactiva
  // el optimizador. Con `unoptimized: true` el endpoint /_next/image responde
  // 404 y deja de exponer la superficie de ataque del optimizador de imágenes.
  // Si en el futuro se incorpora next/image, revisar esta opción.
  images: {
    unoptimized: true,
  },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Content-Security-Policy",
        value: contentSecurityPolicy,
      });
    }
    if (httpsProduction) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000",
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
