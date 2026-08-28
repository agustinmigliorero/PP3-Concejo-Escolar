"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
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
