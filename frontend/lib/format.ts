// Fuente única de verdad para formato de dinero/fecha es-AR.
// Implementaciones extraídas textualmente de las páginas que las duplicaban.

/**
 * Moneda es-AR ARS con 2 dígitos fraccionarios mínimos.
 * Valores NaN/coercibles a NaN se devuelven como su string original.
 * (Adopta la implementación exacta de pedidos/reportes.)
 */
export function formatMoney(v: string | number): string {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

/**
 * Representación compacta es-AR ARS (semántica moneyShort de reportes).
 * Valores no finitos se renderizan como "$0".
 */
export function formatMoneyShort(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

/**
 * Fecha+hora corta es-AR; "Sin carga" para null/inválido (implementación de escuelas/[id]).
 */
export function formatDate(value: string | null): string {
  if (!value) return "Sin carga";
  const date = parseAsUTC(value);
  if (Number.isNaN(date.getTime())) return "Sin carga";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Trata las cadenas de fecha/hora almacenadas como UTC a menos que ya tengan
 * un indicador de zona horaria. Evita desviación de zona al renderizar hora local.
 */
export function parseAsUTC(value: string): Date {
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  return new Date(value + "Z");
}

/**
 * Fecha local YYYY-MM-DD desde un Date (semántica formatLocalDate de pedidos).
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
