// SEC-09 (CWE-601): el destino de redireccion tras el login solo puede ser una
// ruta interna de la aplicacion. Next.js advierte que enviar URLs no
// sanitizadas a `router.push`/`router.replace` habilita XSS y open redirect
// (vease node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md).
const ORIGEN_INTERNO = "http://interno.local";

/**
 * Normaliza un valor de `?from=` a una ruta interna segura.
 * Devuelve `fallback` si el valor esta vacio, no es una ruta interna
 * (URL absoluta, protocol-relative, esquema `javascript:`) o resuelve a otro origen.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value) return fallback;

  // Una ruta interna empieza por "/" y nunca por "//" ni "/\" (protocol-relative).
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  try {
    const url = new URL(value, ORIGEN_INTERNO);
    // Cualquier ruta que resuelva a otro origen (p. ej. "//evil.com") se descarta.
    if (url.origin !== ORIGEN_INTERNO) return fallback;

    const target = `${url.pathname}${url.search}${url.hash}`;
    // El parser normaliza los segmentos "." y ".." y puede convertir una ruta
    // aparentemente interna en una autoridad protocol-relative
    // ("/.//evil.com" -> "//evil.com"), que el router resolveria fuera del
    // origen. El destino final se valida de nuevo: debe seguir siendo interno.
    if (!target.startsWith("/")) return fallback;
    if (target.startsWith("//") || target.startsWith("/\\")) return fallback;

    return target;
  } catch {
    return fallback;
  }
}
