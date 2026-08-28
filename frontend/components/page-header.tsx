"use client";

/**
 * Título de página + acción opcional en el encabezado (ej. el botón
 * "+ Nuevo X" de crear), copiado del bloque de encabezado de usuarios/localidades.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  if (description) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{title}</h1>
      {children}
    </div>
  );
}
