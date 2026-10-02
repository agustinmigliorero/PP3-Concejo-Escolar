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
  submitLabel = "Guardar",
  submitDisabled = false,
}: {
  open: boolean;
  title: string;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  width?: string;
  submitLabel?: string;
  submitDisabled?: boolean;
}) {
  return (
    <InlineModal
      open={open}
      title={title}
      onClose={() => { if (!saving) onClose(); }}
      width={width}
      scrollBody={false}
    >
      <div className="min-h-0 overflow-y-auto -mx-1 px-1">
        {children}
      </div>
      {error && (
        <p role="alert" className="shrink-0 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
          {error}
        </p>
      )}
      <div className="shrink-0 flex flex-col sm:flex-row gap-3 pt-4 mt-4 border-t border-gray-100">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || submitDisabled}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? "Guardando..." : submitLabel}
        </button>
      </div>
    </InlineModal>
  );
}
