"use client";

const TONE: Record<StatusKind, string> = {
  error: "text-red-600 bg-red-50 border-red-200",
  success: "text-green-700 bg-green-50 border-green-200",
  warning: "text-amber-700 bg-amber-50 border-amber-200",
};

type StatusKind = "error" | "success" | "warning";

/**
 * Renderiza el bloque de banner `p.bg-*-50 border rounded` rojo/verde/ámbar
 * utilizado en las páginas del dashboard. Un componente, tres mapas de tono.
 */
export function StatusBanner({
  kind = "error",
  children,
  className = "",
}: {
  kind?: StatusKind;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-sm border rounded-lg px-4 py-2 mb-4 ${TONE[kind]} ${className}`}
    >
      {children}
    </p>
  );
}
