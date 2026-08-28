"use client";

/**
 * Envuelve la tarjeta de tabla y maneja los estados de carga + vacío (AD-5).
 * La página posee la `<table>`/filas (las celdas de fila/acción son específicas
 * del dominio), pasadas vía children.
 */
export function TableState({
  loading,
  empty,
  emptyText,
  colSpan,
  children,
}: {
  loading: boolean;
  empty?: boolean;
  emptyText?: string;
  colSpan?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {loading ? (
        <p className="text-gray-400 text-sm p-6">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          {empty && colSpan ? (
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    {emptyText}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
