"use client";

import { useEffect } from "react";

/**
 * Shell de modal con overlay + tarjeta blanca utilizado por diálogos de
 * crear/editar y confirmar. Maneja el overlay fijo, cerrar con ESC, y el
 * acabado de la tarjeta; el cuerpo (campos, texto, botones de pie) se
 * provee vía children.
 */
export function InlineModal({
  open,
  title,
  onClose,
  children,
  width = "max-w-md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${width} p-5 sm:p-6`}>
        <h2 className="text-lg font-bold text-gray-800 mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}
