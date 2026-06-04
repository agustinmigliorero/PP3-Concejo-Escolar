"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiConfirmPedido,
  apiDownloadPedidoExport,
  apiGetPedidos,
  apiGetSchoolStock,
  apiGetSchools,
  apiGetTemporadaActiva,
  apiPreviewPedido,
  type PedidoRecord,
  type PedidoSnapshot,
  type SchoolRecord,
  type StockPrevioSchoolRecord,
  type TemporadaRecord,
} from "@/lib/api";
import { showSuccessToast } from "@/components/toast";

const DAYS = [
  { id: 1, label: "Lun", name: "Lunes" },
  { id: 2, label: "Mar", name: "Martes" },
  { id: 3, label: "Mie", name: "Miercoles" },
  { id: 4, label: "Jue", name: "Jueves" },
  { id: 5, label: "Vie", name: "Viernes" },
];

type PedidoExportScope = "resumen" | "proveedores" | "localidades" | "escuelas";

type PedidoFilters = {
  localidad_id?: number | null;
  proveedor_id?: number | null;
  escuela_id?: number | null;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextWeekMondayIso(date = new Date()): string {
  const dayOfWeek = date.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayThisWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
  mondayThisWeek.setDate(mondayThisWeek.getDate() + 7);
  return formatLocalDate(mondayThisWeek);
}

function isMondayIso(value: string): boolean {
  if (!value) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getDay() === 1;
}

function money(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

function seasonLabel(temporada: TemporadaRecord): string {
  return `${temporada.nombre === "VERANO" ? "Verano" : "Invierno"} ${temporada.anio}`;
}

function uniqueById<T extends { id: number }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function filteredPedidoCost(pedido: PedidoRecord, filters: PedidoFilters): string {
  const total = pedido.datos_snapshot.escuelas.reduce((schoolTotal, school) => {
    if (filters.localidad_id && school.localidad_id !== filters.localidad_id) {
      return schoolTotal;
    }
    if (filters.escuela_id && school.escuela_id !== filters.escuela_id) {
      return schoolTotal;
    }

    const itemTotal = school.ingredientes.reduce((sum, item) => {
      if (filters.proveedor_id && item.proveedor_id !== filters.proveedor_id) {
        return sum;
      }
      const cost = Number(item.costo_total ?? 0);
      return Number.isNaN(cost) ? sum : sum + cost;
    }, 0);

    return schoolTotal + itemTotal;
  }, 0);

  return total.toFixed(2);
}

export default function PedidosPage() {
  const { user } = useUser();
  const canGenerate = user?.role === "admin" || user?.role === "gestor";
  const canViewHistory = canGenerate || user?.role === "escuela";

  const [temporada, setTemporada] = useState<TemporadaRecord | null>(null);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [stockRecords, setStockRecords] = useState<StockPrevioSchoolRecord[]>([]);
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [opcionId, setOpcionId] = useState("");
  const [semanaInicio, setSemanaInicio] = useState(nextWeekMondayIso());
  const [diasHabiles, setDiasHabiles] = useState<number[]>([1, 2, 3, 4, 5]);
  const [notas, setNotas] = useState("");
  const [snapshot, setSnapshot] = useState<PedidoSnapshot | null>(null);
  const [pedidos, setPedidos] = useState<PedidoRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"generar" | "historial">("generar");
  const [historySearch, setHistorySearch] = useState("");
  const [historyLocalidadId, setHistoryLocalidadId] = useState("");
  const [historyProveedorId, setHistoryProveedorId] = useState("");
  const [historyEscuelaId, setHistoryEscuelaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pedidosData = await apiGetPedidos();
      setPedidos(pedidosData);
      if (canGenerate) {
        const [activeSeason, schoolsData] = await Promise.all([
          apiGetTemporadaActiva(),
          apiGetSchools(),
        ]);
        setTemporada(activeSeason);
        setSchools(schoolsData.filter((school) => school.active));
        const firstOption = activeSeason.opciones_menu[0];
        if (firstOption) setOpcionId(String(firstOption.id));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, [canGenerate]);

  useEffect(() => {
    if (canViewHistory) {
      loadData();
    } else if (user) {
      setLoading(false);
    }
  }, [canViewHistory, loadData, user]);

  useEffect(() => {
    if (user?.role === "escuela") {
      setActiveTab("historial");
    }
  }, [user?.role]);

  const selectedOption = useMemo(
    () => temporada?.opciones_menu.find((opcion) => String(opcion.id) === opcionId),
    [temporada, opcionId],
  );

  const existingPedido = useMemo(
    () => pedidos.find((pedido) => pedido.semana_inicio === semanaInicio) ?? null,
    [pedidos, semanaInicio],
  );
  const currentTab = canGenerate ? activeTab : "historial";
  const historyFilters = useMemo<PedidoFilters>(
    () => ({
      localidad_id: historyLocalidadId ? Number(historyLocalidadId) : null,
      proveedor_id: historyProveedorId ? Number(historyProveedorId) : null,
      escuela_id: historyEscuelaId ? Number(historyEscuelaId) : null,
    }),
    [historyEscuelaId, historyLocalidadId, historyProveedorId],
  );
  const historyOptions = useMemo(() => {
    const localidades = uniqueById(
      pedidos.flatMap((pedido) =>
        pedido.datos_snapshot.escuelas.map((school) => ({
          id: school.localidad_id,
          nombre: school.localidad_nombre,
        })),
      ),
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));

    const proveedores = uniqueById(
      pedidos.flatMap((pedido) =>
        pedido.datos_snapshot.proveedores.map((provider) => ({
          id: provider.proveedor_id,
          nombre: provider.proveedor_nombre,
          localidad_id: provider.localidad_id,
          localidad_nombre: provider.localidad_nombre,
        })),
      ),
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));

    const escuelas = uniqueById(
      pedidos.flatMap((pedido) =>
        pedido.datos_snapshot.escuelas.map((school) => ({
          id: school.escuela_id,
          nombre: school.nombre,
          codigo: school.codigo,
          localidad_id: school.localidad_id,
        })),
      ),
    ).sort((a, b) => `${a.codigo} ${a.nombre}`.localeCompare(`${b.codigo} ${b.nombre}`));

    return { localidades, proveedores, escuelas };
  }, [pedidos]);
  const filteredPedidos = useMemo(() => {
    const normalizedSearch = historySearch.trim().toLowerCase();
    return pedidos.filter((pedido) => {
      const snapshot = pedido.datos_snapshot;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        pedido.semana_inicio.includes(normalizedSearch) ||
        snapshot.opcion_menu.numero_opcion.toString().includes(normalizedSearch) ||
        snapshot.escuelas.some((school) =>
          `${school.codigo} ${school.nombre} ${school.localidad_nombre}`
            .toLowerCase()
            .includes(normalizedSearch),
        ) ||
        snapshot.proveedores.some((provider) =>
          `${provider.proveedor_nombre} ${provider.localidad_nombre}`
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesLocalidad =
        !historyFilters.localidad_id ||
        snapshot.escuelas.some((school) => school.localidad_id === historyFilters.localidad_id);
      const matchesProveedor =
        !historyFilters.proveedor_id ||
        snapshot.proveedores.some((provider) => provider.proveedor_id === historyFilters.proveedor_id);
      const matchesEscuela =
        !historyFilters.escuela_id ||
        snapshot.escuelas.some((school) => school.escuela_id === historyFilters.escuela_id);

      const hasScopedFilter =
        Boolean(historyFilters.localidad_id) ||
        Boolean(historyFilters.proveedor_id) ||
        Boolean(historyFilters.escuela_id);
      const hasFilteredData = !hasScopedFilter || Number(filteredPedidoCost(pedido, historyFilters)) > 0;

      return matchesSearch && matchesLocalidad && matchesProveedor && matchesEscuela && hasFilteredData;
    });
  }, [historyFilters, historySearch, pedidos]);
  const selectedDayNames = useMemo(
    () =>
      DAYS.filter((day) => diasHabiles.includes(day.id))
        .map((day) => day.name)
        .join(", "),
    [diasHabiles],
  );
  const previewDisabled = previewing || !selectedOption || Boolean(existingPedido);
  const confirmDisabled = confirming || !snapshot || Boolean(existingPedido);

  function toggleDay(day: number) {
    setDiasHabiles((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b),
    );
    setSnapshot(null);
  }

  function stockKey(schoolId: number, ingredientId: number): string {
    return `${schoolId}:${ingredientId}`;
  }

  async function loadStockMatrix() {
    if (schools.length === 0) return;

    setStockLoading(true);
    setError(null);
    try {
      const records = await Promise.all(
        schools.map((school) => apiGetSchoolStock(school.id)),
      );
      const draft: Record<string, string> = {};
      for (const record of records) {
        for (const item of record.items) {
          draft[stockKey(record.escuela_id, item.ingrediente_id)] = String(Number(item.cantidad));
        }
      }
      setStockRecords(records);
      setStockDraft(draft);
      setSnapshot(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar stock previo");
    } finally {
      setStockLoading(false);
    }
  }

  function buildStockOverrides() {
    return Object.entries(stockDraft).map(([key, rawValue]) => {
      const [schoolId, ingredientId] = key.split(":").map(Number);
      return {
        escuela_id: schoolId,
        ingrediente_id: ingredientId,
        cantidad: Number(rawValue) || 0,
      };
    });
  }

  async function preview() {
    if (existingPedido) {
      setError("Ya existe un pedido para esa semana. Usa el reporte generado anteriormente.");
      return;
    }
    if (!isMondayIso(semanaInicio)) {
      setError("Selecciona el lunes de la semana que queres generar.");
      return;
    }
    if (!opcionId) {
      setError("Selecciona una opcion de menu");
      return;
    }
    if (diasHabiles.length === 0) {
      setError("Selecciona al menos un dia habil");
      return;
    }

    setPreviewing(true);
    setError(null);
    try {
      const nextSnapshot = await apiPreviewPedido({
        semana_inicio: semanaInicio,
        opcion_menu_id: Number(opcionId),
        dias_habiles: diasHabiles,
        stock_overrides: buildStockOverrides(),
        notas: notas || null,
      });
      setSnapshot(nextSnapshot);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al previsualizar pedido");
    } finally {
      setPreviewing(false);
    }
  }

  async function confirm() {
    if (!snapshot || !opcionId || existingPedido) return;

    setConfirming(true);
    setError(null);
    try {
      await apiConfirmPedido({
        semana_inicio: semanaInicio,
        opcion_menu_id: Number(opcionId),
        dias_habiles: diasHabiles,
        stock_overrides: buildStockOverrides(),
        notas: notas || null,
      });
      setSnapshot(null);
      setNotas("");
      setStockRecords([]);
      setStockDraft({});
      await loadData();
      showSuccessToast("Pedido generado correctamente");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al confirmar pedido");
    } finally {
      setConfirming(false);
    }
  }

  async function downloadPedido(
    pedido: PedidoRecord,
    format: "pdf" | "excel",
    scope: PedidoExportScope,
    filters?: PedidoFilters,
  ) {
    setError(null);
    try {
      const blob = await apiDownloadPedidoExport(pedido.id, format, scope, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = scope === "resumen" ? (format === "pdf" ? "pdf" : "xlsx") : "zip";
      link.href = url;
      link.download = `${scope}_${pedido.id}_${pedido.semana_inicio}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al descargar pedido");
    }
  }

  if (!user || loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (!canViewHistory) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No tenes permisos para ver pedidos.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generacion semanal basada en la temporada activa.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className={`grid gap-2 ${canGenerate ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
          {canGenerate && (
            <button
              type="button"
              onClick={() => setActiveTab("generar")}
              className={`rounded-xl px-4 py-3 text-left transition-colors ${
                currentTab === "generar"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="block text-sm font-bold">Generar pedido</span>
              <span className={`mt-1 block text-xs ${
                currentTab === "generar" ? "text-blue-50" : "text-slate-500"
              }`}>
                Preparacion semanal, stock y previsualizacion.
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("historial")}
            className={`rounded-xl px-4 py-3 text-left transition-colors ${
              currentTab === "historial"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block text-sm font-bold">Historial y reportes</span>
            <span className={`mt-1 block text-xs ${
              currentTab === "historial" ? "text-blue-50" : "text-slate-500"
            }`}>
              Pedidos generados, filtros y descargas por agrupacion.
            </span>
          </button>
        </div>
      </div>

      {canGenerate && currentTab === "generar" && (
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                Generacion semanal
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Preparar pedido
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Configura la semana, revisa el calculo y confirma solo cuando la previsualizacion este lista.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                1. Configurar
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                2. Previsualizar
              </span>
              <span className={`rounded-full border px-3 py-1 ${
                snapshot
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white"
              }`}>
                3. Confirmar
              </span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-6 p-5">
            <div>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Datos de la semana</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Estos datos definen que menu y que dias se van a calcular.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Temporada
                  </label>
                  <div className="flex min-h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">
                    {temporada ? seasonLabel(temporada) : "Sin temporada activa"}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Opcion de menu
                  </label>
                  <select
                    value={opcionId}
                    onChange={(event) => {
                      setOpcionId(event.target.value);
                      setSnapshot(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {temporada?.opciones_menu.map((opcion) => (
                      <option key={opcion.id} value={opcion.id}>
                        Opcion {opcion.numero_opcion} - {opcion.descripcion}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Lunes de la semana
                  </label>
                  <input
                    type="date"
                    value={semanaInicio}
                    onChange={(event) => {
                      setSemanaInicio(event.target.value);
                      setSnapshot(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <fieldset className="mt-5">
                <legend className="text-sm font-bold text-slate-900">
                  Dias habiles
                </legend>
                <p className="mt-1 text-sm text-slate-500">
                  Cada dia incluido suma raciones al calculo. Los dias quitados no se computan.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {DAYS.map((day) => {
                    const active = diasHabiles.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleDay(day.id)}
                        className={`min-h-[4.75rem] rounded-lg border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-blue-600 bg-blue-50 text-blue-950 shadow-[inset_0_0_0_1px_var(--brand)]"
                            : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-base font-bold">{day.label}</span>
                          <span className={`h-3 w-3 rounded-full border ${
                            active
                              ? "border-blue-700 bg-blue-700"
                              : "border-slate-300 bg-white"
                          }`} />
                        </span>
                        <span className={`mt-2 block text-xs font-semibold ${
                          active ? "text-blue-700" : "text-slate-500"
                        }`}>
                          {active ? "Incluido" : "No incluido"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {existingPedido && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm font-bold text-blue-950">
                  Ya existe un pedido generado para la semana {existingPedido.semana_inicio}.
                </p>
                <p className="mt-1 text-sm text-blue-800">
                  No se genera un duplicado. Descarga el reporte anterior desde aca o desde el historial.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPedido(existingPedido, "pdf", "resumen")}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Resumen PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPedido(existingPedido, "excel", "resumen")}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Resumen Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPedido(existingPedido, "pdf", "proveedores")}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Ordenes PDF ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPedido(existingPedido, "excel", "proveedores")}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Ordenes Excel ZIP
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-5">
              <label className="mb-1 block text-sm font-bold text-slate-900">
                Notas
              </label>
              <input
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Opcional"
              />
            </div>

            <div className="border-t border-gray-100 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Stock previo editable</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      Opcional
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Se usa solo para este calculo; al confirmar, el stock de las escuelas incluidas vuelve a 0.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadStockMatrix}
                  disabled={stockLoading || schools.length === 0 || Boolean(existingPedido)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {stockLoading ? "Cargando stock..." : "Cargar stock actual"}
                </button>
              </div>

              {stockRecords.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="min-w-56 px-4 py-3 text-left font-medium">Escuela</th>
                        {stockRecords[0]?.items.map((item) => (
                          <th key={item.ingrediente_id} className="min-w-36 px-4 py-3 text-left font-medium">
                            {item.ingrediente_nombre}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stockRecords.map((record) => (
                        <tr key={record.escuela_id}>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {record.escuela_nombre}
                          </td>
                          {record.items.map((item) => (
                            <td key={item.ingrediente_id} className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={stockDraft[stockKey(record.escuela_id, item.ingrediente_id)] ?? "0"}
                                onChange={(event) => {
                                  setStockDraft((current) => ({
                                    ...current,
                                    [stockKey(record.escuela_id, item.ingrediente_id)]: event.target.value,
                                  }));
                                  setSnapshot(null);
                                }}
                                className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="border-t border-gray-100 bg-slate-50/80 p-5 lg:border-l lg:border-t-0">
            <div className="lg:sticky lg:top-24">
              <h3 className="text-sm font-bold text-slate-900">Resumen para confirmar</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Menu
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {selectedOption
                      ? `Opcion ${selectedOption.numero_opcion}`
                      : "Sin opcion seleccionada"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Semana
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">{semanaInicio}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Dias incluidos
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {diasHabiles.length} de {DAYS.length}
                  </dd>
                  <dd className="mt-1 text-slate-600">
                    {selectedDayNames || "Selecciona al menos un dia"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Stock cargado
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {stockRecords.length > 0
                      ? `${stockRecords.length} escuelas`
                      : "Sin stock manual"}
                  </dd>
                </div>
              </dl>

              <div className={`mt-5 rounded-lg border px-3 py-3 text-sm ${
                snapshot
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}>
                <p className="font-bold">
                  {snapshot ? "Previsualizacion lista" : "Falta previsualizar"}
                </p>
                <p className="mt-1">
                  {snapshot
                    ? `Costo estimado: ${money(snapshot.costo_total)}. Ya podes confirmar el pedido.`
                    : "Primero revisa el calculo para habilitar la confirmacion."}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {existingPedido
              ? "Esta semana ya tiene pedido generado."
              : snapshot
                ? "Revisa la previsualizacion de abajo antes de confirmar."
                : "La confirmacion se habilita despues de previsualizar."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={preview}
              disabled={previewDisabled}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
            >
              {previewing ? "Calculando..." : "Previsualizar pedido"}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={confirmDisabled}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
            >
              {confirming ? "Confirmando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      </section>
      )}

      {canGenerate && currentTab === "generar" && snapshot && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Previsualizacion</h2>
              <p className="text-sm text-gray-500">
                {snapshot.resumen_global.length} filas de resumen - Costo total {money(snapshot.costo_total)}
              </p>
            </div>
          </div>

          {snapshot.advertencias.length > 0 && (
            <div className="m-5 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Advertencias por ingredientes sin proveedor
              </p>
              <ul className="text-sm text-yellow-800 space-y-1">
                {snapshot.advertencias.slice(0, 8).map((warning, index) => (
                  <li key={`${warning.escuela_nombre}-${warning.ingrediente_nombre}-${index}`}>
                    {warning.escuela_nombre} - {warning.localidad_nombre}: {warning.ingrediente_nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Ingrediente</th>
                  <th className="text-left font-medium px-5 py-3">Localidad</th>
                  <th className="text-left font-medium px-5 py-3">Proveedor</th>
                  <th className="text-right font-medium px-5 py-3">Cantidad</th>
                  <th className="text-right font-medium px-5 py-3">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {snapshot.resumen_global.map((row, index) => (
                  <tr key={`${row.ingrediente_id}-${row.localidad_nombre}-${index}`}>
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {row.ingrediente_nombre}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{row.localidad_nombre}</td>
                    <td className="px-5 py-3 text-gray-600">{row.proveedor_nombre}</td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {row.cantidad_total} {row.unidad}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-800">
                      {money(row.costo_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {currentTab === "historial" && (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Historial y reportes</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {user.role === "escuela"
                    ? "Solo se muestran pedidos donde esta incluida tu escuela."
                    : "Filtra el historial y descarga PDFs agrupados desde el snapshot de cada semana."}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-bold text-slate-900">{filteredPedidos.length}</span>{" "}
                de {pedidos.length} pedidos
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                  Buscar
                </label>
                <input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Semana, escuela, proveedor..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                  Localidad
                </label>
                <select
                  value={historyLocalidadId}
                  onChange={(event) => {
                    setHistoryLocalidadId(event.target.value);
                    setHistoryEscuelaId("");
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  {historyOptions.localidades.map((localidad) => (
                    <option key={localidad.id} value={localidad.id}>
                      {localidad.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                  Proveedor
                </label>
                <select
                  value={historyProveedorId}
                  onChange={(event) => setHistoryProveedorId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {historyOptions.proveedores.map((proveedor) => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                  Escuela
                </label>
                <select
                  value={historyEscuelaId}
                  onChange={(event) => setHistoryEscuelaId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  {historyOptions.escuelas
                    .filter((school) => !historyLocalidadId || school.localidad_id === Number(historyLocalidadId))
                    .map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.codigo} - {school.nombre}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {(historySearch || historyLocalidadId || historyProveedorId || historyEscuelaId) && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch("");
                    setHistoryLocalidadId("");
                    setHistoryProveedorId("");
                    setHistoryEscuelaId("");
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Semana</th>
                  <th className="px-5 py-3 text-left font-medium">Menu</th>
                  <th className="px-5 py-3 text-left font-medium">Dias</th>
                  <th className="px-5 py-3 text-right font-medium">Costo filtrado</th>
                  <th className="px-5 py-3 text-right font-medium">PDFs</th>
                  <th className="px-5 py-3 text-right font-medium">Excel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {pedido.semana_inicio}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      Opcion {pedido.datos_snapshot.opcion_menu.numero_opcion}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {pedido.dias_habiles.join(", ")}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-800">
                      {money(filteredPedidoCost(pedido, historyFilters))}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => downloadPedido(pedido, "pdf", "resumen", historyFilters)}
                          className="rounded-lg px-2 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          Semana
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadPedido(pedido, "pdf", "localidades", historyFilters)}
                          className="rounded-lg px-2 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          Localidades ZIP
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadPedido(pedido, "pdf", "proveedores", historyFilters)}
                          className="rounded-lg px-2 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          Proveedor/localidad ZIP
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadPedido(pedido, "pdf", "escuelas", historyFilters)}
                          className="rounded-lg px-2 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          Escuelas ZIP
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => downloadPedido(pedido, "excel", "resumen", historyFilters)}
                          className="rounded-lg px-2 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          Resumen
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadPedido(pedido, "excel", "proveedores", historyFilters)}
                          className="rounded-lg px-2 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          Proveedores ZIP
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPedidos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                      No hay pedidos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
