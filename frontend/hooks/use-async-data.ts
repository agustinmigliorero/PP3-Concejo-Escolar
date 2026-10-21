"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

function depsChanged(
  prev: ReadonlyArray<unknown>,
  next: ReadonlyArray<unknown>,
): boolean {
  return (
    prev.length !== next.length ||
    prev.some((value, index) => !Object.is(value, next[index]))
  );
}

/**
 * Carga datos asíncronos con la guardia "active" establecida para limpieza,
 * de modo que una resolución tardía después de unmount / cambio de dep
 * nunca escriba estado. Devuelve { data, loading, error, reload }.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // El efecto siempre invoca el `loader` más reciente sin que éste sea una
  // dependencia (antes se copiaba a una ref durante el render).
  const runLoader = useEffectEvent(() => loader());

  // Cuando cambian las dependencias de la carga (o se pide `reload`), se marca
  // la carga y se limpia el error en el mismo render, en lugar de hacerlo de
  // forma síncrona dentro del efecto (patrón de React para ajustar estado
  // cuando cambia un valor).
  const requestDeps = [...deps, refreshKey];
  const [prevRequestDeps, setPrevRequestDeps] = useState(requestDeps);
  if (depsChanged(prevRequestDeps, requestDeps)) {
    setPrevRequestDeps(requestDeps);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let active = true;
    runLoader()
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Error al cargar los datos");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey]);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { data, loading, error, reload };
}
