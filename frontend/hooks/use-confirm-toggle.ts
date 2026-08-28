"use client";

import { useState } from "react";

/**
 * Administra el estado del diálogo de confirmación de activar/desactivar
 * ({target, toggling, confirm, close}) y llama al `toggle` inyectado
 * (típicamente useCrud.toggleActive). La página provee onSuccess/onError
 * para conservar su propio comportamiento de toast/error textualmente.
 */
export function useConfirmToggle<T extends { id: number }>(opts: {
  toggle: (id: number) => Promise<T | null>;
  onSuccess?: (updated: T | null) => void;
  onError?: (e: unknown) => void;
}) {
  const [target, setTarget] = useState<T | null>(null);
  const [toggling, setToggling] = useState(false);

  function confirm(item: T) {
    setTarget(item);
  }

  function close() {
    setTarget(null);
  }

  async function handleConfirm() {
    if (!target) return;
    setToggling(true);
    try {
      const updated = await opts.toggle(target.id);
      setTarget(null);
      opts.onSuccess?.(updated);
    } catch (e: unknown) {
      setTarget(null);
      opts.onError?.(e);
    } finally {
      setToggling(false);
    }
  }

  return { target, toggling, confirm, close, handleConfirm };
}
