"use client";

import { InlineModal } from "./inline-modal";

/**
 * Shell de formulario controlado crear/editar (AD-1). La página posee
 * el estado del dominio y `onSubmit`; este componente compone el shell
 * del InlineModal, el banner de error de formulario, y el pie
 * Cancelar/Guardar.
 */
export function CrudFormModal({
  open,
  title,
  error,
  saving,
  onClose,
  onSubmit,
  children,
  width = "max-w-md",
}: {
  open: boolean;
  title: string;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <InlineModal open={open} title={title} onClose={onClose} width={width}>
      {children}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
          {error}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </InlineModal>
  );
}
