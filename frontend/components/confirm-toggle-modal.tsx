"use client";

/**
 * Diálogo de confirmación para toggles activar/desactivar (AD-2).
 * La página compone el título/mensaje/confirmLabel en español textual
 * (incl. género "el/la ..."); el componente permanece tonto. `destructive`
 * elige el color del botón confirmar: rojo al desactivar, verde al activar.
 */
export function ConfirmToggleModal({
  title,
  message,
  confirmLabel,
  busy,
  busyLabel = "Guardando...",
  width = "max-w-sm",
  destructive = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  busy: boolean;
  busyLabel?: string;
  width?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${width} p-5 sm:p-6`}>
        <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50 text-white ${
              destructive
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
