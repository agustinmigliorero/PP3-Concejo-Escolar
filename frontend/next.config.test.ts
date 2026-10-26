import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "./next.config";

type Regla = { source: string; headers: Array<{ key: string; value: string }> };

async function reglas(): Promise<Regla[]> {
  if (typeof nextConfig.headers !== "function") {
    throw new Error("next.config.ts no define headers()");
  }
  return await nextConfig.headers();
}

function valorDe(reglas: Regla[], clave: string): string | undefined {
  const cabecera = reglas[0]?.headers.find(
    (h) => h.key.toLowerCase() === clave.toLowerCase(),
  );
  return cabecera?.value;
}

describe("SEC-10 next.config.ts cabeceras de seguridad", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no expone la tecnologia del servidor", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("aplica las cabeceras de seguridad a todas las rutas", async () => {
    const aplicadas = await reglas();

    expect(aplicadas).toHaveLength(1);
    expect(aplicadas[0].source).toBe("/:path*");
    expect(valorDe(aplicadas, "X-Frame-Options")).toBe("DENY");
    expect(valorDe(aplicadas, "X-Content-Type-Options")).toBe("nosniff");
    expect(valorDe(aplicadas, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(valorDe(aplicadas, "Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("define la CSP solo en produccion", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(valorDe(await reglas(), "Content-Security-Policy")).toBeUndefined();

      vi.stubEnv("NODE_ENV", "production");
      const csp = valorDe(await reglas(), "Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      expect(csp).toContain(`connect-src 'self' ${api}`);
  });
});
