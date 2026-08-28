"use client";

import { useState } from "react";
import { useAsyncData } from "./use-async-data";

/**
 * Hook genérico de CRUD (AD-4). Las funciones de API se inyectan como
 * dependencias porque las firmas de api.ts difieren por dominio; las páginas
 * de solo lectura simplemente omiten create/update/toggle. `toggleActive`
 * actualiza el item en el lugar mediante el patrón map (usuarios/localidades),
 * no una recarga completa.
 */
export function useCrud<T extends { id: number }>(cfg: {
  list: () => Promise<T[]>;
  create?: (data: unknown) => Promise<T>;
  update?: (id: number, data: unknown) => Promise<T>;
  toggleKey: "active" | "activo";
  toggle?: (id: number) => Promise<T>;
}) {
  const { data, loading, error, reload } = useAsyncData<T[]>(cfg.list);
  const [items, setItems] = useState<T[]>([]);
  const [dataRef, setDataRef] = useState<T[] | null>(null);

  // Semilla items cada vez que la identidad subyacente de datos cambia.
  // La derivación en tiempo de renderizado (el patrón documentado "ajustar
  // estado cuando una prop cambia") evita un setState-in-effect, preservando
  // las actualizaciones de toggle en el lugar.
  if (data !== dataRef) {
    setDataRef(data);
    setItems(data ?? []);
  }

  async function create(form: unknown): Promise<T | null> {
    if (!cfg.create) return null;
    const created = await cfg.create(form);
    await reload();
    return created;
  }

  async function update(id: number, form: unknown): Promise<T | null> {
    if (!cfg.update) return null;
    const updated = await cfg.update(id, form);
    await reload();
    return updated;
  }

  async function toggleActive(id: number): Promise<T | null> {
    if (!cfg.toggle) return null;
    const updated = await cfg.toggle(id);
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    return updated;
  }

  return { items, loading, error, reload, create, update, toggleActive };
}
