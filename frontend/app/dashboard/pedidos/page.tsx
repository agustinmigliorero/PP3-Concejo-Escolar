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
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mie" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
];

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

  const selectedOption = useMemo(
    () => temporada?.opciones_menu.find((opcion) => String(opcion.id) === opcionId),
    [temporada, opcionId],
  );

  const existingPedido = useMemo(
    () => pedidos.find((pedido) => pedido.semana_inicio === semanaInicio) ?? null,
    [pedidos, semanaInicio],
  );

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
    scope: "resumen" | "proveedores",
  ) {
    setError(null);
    try {
      const blob = await apiDownloadPedidoExport(pedido.id, format, scope);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = scope === "proveedores" ? "zip" : format === "pdf" ? "pdf" : "xlsx";
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

      {canGenerate && (
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temporada
            </label>
            <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
              {temporada ? seasonLabel(temporada) : "Sin temporada activa"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opcion
            </label>
            <select
              value={opcionId}
              onChange={(event) => {
                setOpcionId(event.target.value);
                setSnapshot(null);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {temporada?.opciones_menu.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  Opcion {opcion.numero_opcion} - {opcion.descripcion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lunes de la semana
            </label>
            <input
              type="date"
              value={semanaInicio}
              onChange={(event) => {
                setSemanaInicio(event.target.value);
                setSnapshot(null);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dias habiles
            </label>
            <div className="flex gap-1">
              {DAYS.map((day) => {
                const active = diasHabiles.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`h-10 min-w-11 rounded-lg text-sm font-medium border transition-colors ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {existingPedido && (
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">
              Ya existe un pedido generado para la semana {existingPedido.semana_inicio}.
            </p>
            <p className="text-sm text-blue-800 mt-1">
              No se genera un duplicado. Descarga el reporte anterior desde aca o desde el historial.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => downloadPedido(existingPedido, "pdf", "resumen")}
                className="bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Resumen PDF
              </button>
              <button
                type="button"
                onClick={() => downloadPedido(existingPedido, "excel", "resumen")}
                className="bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Resumen Excel
              </button>
              <button
                type="button"
                onClick={() => downloadPedido(existingPedido, "pdf", "proveedores")}
                className="bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Ordenes PDF ZIP
              </button>
              <button
                type="button"
                onClick={() => downloadPedido(existingPedido, "excel", "proveedores")}
                className="bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Ordenes Excel ZIP
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <input
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Opcional"
          />
        </div>

        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Stock previo editable</h2>
              <p className="text-sm text-gray-500">
                Se usa solo para este calculo; al confirmar, el stock de las escuelas incluidas vuelve a 0.
              </p>
            </div>
            <button
              type="button"
              onClick={loadStockMatrix}
              disabled={stockLoading || schools.length === 0 || Boolean(existingPedido)}
              className="border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {stockLoading ? "Cargando..." : "Cargar stock actual"}
            </button>
          </div>

          {stockRecords.length > 0 && (
            <div className="mt-4 overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-4 py-3 min-w-56">Escuela</th>
                    {stockRecords[0]?.items.map((item) => (
                      <th key={item.ingrediente_id} className="text-left font-medium px-4 py-3 min-w-36">
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
                            className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={preview}
            disabled={previewing || !selectedOption || Boolean(existingPedido)}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {previewing ? "Calculando..." : "Previsualizar"}
          </button>
          <button
            onClick={confirm}
            disabled={confirming || !snapshot || Boolean(existingPedido)}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {confirming ? "Confirmando..." : "Confirmar pedido"}
          </button>
        </div>
      </section>
      )}

      {canGenerate && snapshot && (
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

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Historial</h2>
          {user.role === "escuela" && (
            <p className="text-sm text-gray-500 mt-1">
              Solo se muestran pedidos donde esta incluida tu escuela.
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left font-medium px-5 py-3">Semana</th>
                <th className="text-left font-medium px-5 py-3">Menu</th>
                <th className="text-left font-medium px-5 py-3">Dias</th>
                <th className="text-right font-medium px-5 py-3">Costo total</th>
                <th className="text-right font-medium px-5 py-3">Resumen</th>
                <th className="text-right font-medium px-5 py-3">Ordenes proveedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map((pedido) => (
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
                    {money(pedido.datos_snapshot.costo_total)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => downloadPedido(pedido, "pdf", "resumen")}
                        className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => downloadPedido(pedido, "excel", "resumen")}
                        className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        Excel
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => downloadPedido(pedido, "pdf", "proveedores")}
                        className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        PDF ZIP
                      </button>
                      <button
                        onClick={() => downloadPedido(pedido, "excel", "proveedores")}
                        className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        Excel ZIP
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    Todavia no hay pedidos generados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
