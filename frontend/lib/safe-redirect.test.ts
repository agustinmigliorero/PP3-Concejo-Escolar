import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

// SEC-09 (CWE-601): tras iniciar sesion solo se admite una ruta interna.
// Cualquier destino absoluto, protocol-relative o con esquema queda bloqueado.
const CASOS: Array<[string | null, string]> = [
  ["/dashboard/pedidos", "/dashboard/pedidos"],
  ["/dashboard?x=1#a", "/dashboard?x=1#a"],
  ["https://evil.com", "/dashboard"],
  ["//evil.com", "/dashboard"],
  ["/\\evil.com", "/dashboard"],
  ["javascript:alert(1)", "/dashboard"],
  ["\t//evil.com", "/dashboard"],
  ["", "/dashboard"],
  [null, "/dashboard"],
];

describe("SEC-09 safeRedirectPath", () => {
  it.each(CASOS)("%s -> %s", (entrada, esperado) => {
    expect(safeRedirectPath(entrada)).toBe(esperado);
  });
});

// La normalizacion de segmentos "." y ".." del parser URL puede convertir una
// ruta aparentemente interna en una autoridad protocol-relative
// ("/.//evil.com" -> "//evil.com"). El destino final debe seguir siendo una
// ruta interna, tambien despues de esa normalizacion.
const CASOS_NORMALIZADOS = [
  "/.//evil.com",
  "/..//evil.com",
  "/.\\/evil.com",
  "/..\\/evil.com",
  "/x/..//evil.com",
  "/x/../..//evil.com",
  "/%2e//evil.com",
  "/%2e%2e//evil.com",
  "/.//evil.com/path?x=1#h",
];

describe("SEC-09 safeRedirectPath (normalizacion de segmentos)", () => {
  it.each(CASOS_NORMALIZADOS)("bloquea %s", (entrada) => {
    const resultado = safeRedirectPath(entrada);
    expect(resultado).toBe("/dashboard");
    expect(new URL(resultado, "https://app.invalid").origin).toBe(
      "https://app.invalid",
    );
  });
});
