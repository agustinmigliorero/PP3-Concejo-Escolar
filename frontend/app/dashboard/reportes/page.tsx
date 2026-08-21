"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiDownloadReporteMensual,
  apiGetEstadisticas,
  apiGetReporteMensual,
  apiGetReporteMeses,
  type Estadisticas,
  type MesDisponible,
  type ReporteMensual,
  type ReportePedidoTipo,
} from "@/lib/api";
import { DonutChart, RankingBars, TrendBars } from "@/components/charts";

const TIPO_FILTERS: Array<{ value: ReportePedidoTipo; label: string }> = [
  { value: "", label: "Todos los tipos" },
  { value: "REGULAR", label: "Semanales" },
  { value: "PATIO", label: "Patios" },
  { value: "EVENTO", label: "Eventos" },
];

function money(value: string | number): string {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

function moneyShort(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function mesKey(item: { anio: number; mes: number }): string {
  return `${item.anio}-${item.mes}`;
}

export default function ReportesPage() {
  const { user } = useUser();
  const canView = user?.role === "admin" || user?.role === "gestor";

  const [tab, setTab] = useState<"estadisticas" | "mensual">("estadisticas");
  const [tipo, setTipo] = useState<ReportePedidoTipo>("");
  const [statsError, setStatsError] = useState<string | null>(null);
  const [mensualError, setMensualError] = useState<string | null>(null);

  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [statAnio, setStatAnio] = useState<string>("");
  const [loadingStats, setLoadingStats] = useState(true);

  const [meses, setMeses] = useState<MesDisponible[]>([]);
  const [selectedMes, setSelectedMes] = useState<string>("");
  const [loadingMeses, setLoadingMeses] = useState(true);
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  // Cada efecto usa una guarda `active` para descartar respuestas fuera de
  // orden: al cambiar los filtros el efecto se re-ejecuta y su cleanup marca
  // como obsoleta la petición anterior, evitando que un fetch viejo pise el
  // estado más reciente. El error se limpia solo al confirmarse un éxito (no
  // al iniciar), y estadísticas/mensual llevan su propio error para no
  // borrarse entre sí.
  useEffect(() => {
    if (!canView) return;
    let active = true;
    setLoadingStats(true);
    apiGetEstadisticas(statAnio ? Number(statAnio) : null, tipo || undefined)
      .then((data) => {
        if (!active) return;
        setEstadisticas(data);
        setStatsError(null);
      })
      .catch((e: unknown) => {
        if (active) setStatsError(e instanceof Error ? e.message : "Error al cargar las estadísticas");
      })
      .finally(() => {
        if (active) setLoadingStats(false);
      });
    return () => {
      active = false;
    };
  }, [canView, statAnio, tipo]);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    setLoadingMeses(true);
    apiGetReporteMeses(tipo || undefined)
      .then((data) => {
        if (!active) return;
        setMeses(data);
        setSelectedMes((current) =>
          current && data.some((item) => mesKey(item) === current)
            ? current
            : data.length
              ? mesKey(data[0])
              : "",
        );
        setMensualError(null);
      })
      .catch((e: unknown) => {
        if (active) setMensualError(e instanceof Error ? e.message : "Error al cargar los meses disponibles");
      })
      .finally(() => {
        if (active) setLoadingMeses(false);
      });
    return () => {
      active = false;
    };
  }, [canView, tipo]);

  useEffect(() => {
    if (!canView || !selectedMes) {
      setReporte(null);
      return;
    }
    const [anio, mes] = selectedMes.split("-").map(Number);
    let active = true;
    setLoadingReporte(true);
    apiGetReporteMensual(anio, mes, tipo || undefined)
      .then((data) => {
        if (!active) return;
        setReporte(data);
        setMensualError(null);
      })
      .catch((e: unknown) => {
        if (active) setMensualError(e instanceof Error ? e.message : "Error al cargar el reporte mensual");
      })
      .finally(() => {
        if (active) setLoadingReporte(false);
      });
    return () => {
      active = false;
    };
  }, [canView, selectedMes, tipo]);

  const trendData = useMemo(
    () =>
      (estadisticas?.tendencia ?? []).map((point) => ({
        label: point.etiqueta,
        value: Number(point.costo_total),
        caption: `${point.num_pedidos} ped.`,
      })),
    [estadisticas],
  );

  async function downloadReporte(format: "pdf" | "excel") {
    if (!selectedMes) return;
    const [anio, mes] = selectedMes.split("-").map(Number);
    setDownloading(format);
    setMensualError(null);
    try {
      const blob = await apiDownloadReporteMensual(anio, mes, format, tipo || undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = format === "pdf" ? "pdf" : "xlsx";
      const suffix = tipo ? `_${tipo.toLowerCase()}` : "";
      link.href = url;
      link.download = `reporte_mensual_${anio}-${String(mes).padStart(2, "0")}${suffix}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setMensualError(e instanceof Error ? e.message : "Error al descargar el reporte");
    } finally {
      setDownloading(null);
    }
  }

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No tenés permisos para ver reportes y estadísticas.
        </p>
      </div>
    );
  }

  const totales = estadisticas?.totales;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reportes y estadísticas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gastos, pedidos y proveedores del Servicio Alimentario Escolar. Incluye pedidos semanales, de patios y de eventos.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTab("estadisticas")}
            className={`rounded-xl px-4 py-3 text-left transition-colors ${
              tab === "estadisticas"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block text-sm font-bold">Estadísticas</span>
            <span className={`mt-1 block text-xs ${tab === "estadisticas" ? "text-blue-50" : "text-slate-500"}`}>
              Tendencia de gasto, localidades, proveedores e ingredientes.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("mensual")}
            className={`rounded-xl px-4 py-3 text-left transition-colors ${
              tab === "mensual"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block text-sm font-bold">Reporte mensual</span>
            <span className={`mt-1 block text-xs ${tab === "mensual" ? "text-blue-50" : "text-slate-500"}`}>
              Consolidado del mes por proveedor, localidad y escuela, con descargas.
            </span>
          </button>
        </div>
      </div>

      {tab === "estadisticas" && (
        <div className="space-y-6">
          {statsError && <ErrorBanner message={statsError} />}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Tipo de pedido
                  </label>
                  <select
                    value={tipo}
                    onChange={(event) => setTipo(event.target.value as ReportePedidoTipo)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-48"
                  >
                    {TIPO_FILTERS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Año
                  </label>
                  <select
                    value={statAnio}
                    onChange={(event) => setStatAnio(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-40"
                  >
                    <option value="">Todos los años</option>
                    {(estadisticas?.anios ?? []).map((anio) => (
                      <option key={anio} value={anio}>
                        {anio}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {loadingStats && !estadisticas ? (
            <p className="py-10 text-center text-sm text-slate-400">Cargando estadísticas...</p>
          ) : totales && totales.num_pedidos > 0 ? (
            <>
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label="Gasto total" value={money(totales.costo_total)} accent />
                <KpiCard label="Pedidos generados" value={String(totales.num_pedidos)} />
                <KpiCard label="Escuelas atendidas" value={String(totales.num_escuelas)} />
                <KpiCard label="Promedio por pedido" value={money(totales.costo_promedio_pedido)} />
                <KpiCard label="Proveedores" value={String(totales.num_proveedores)} />
                <KpiCard label="Localidades" value={String(totales.num_localidades)} />
                {totales.mes_pico_etiqueta && (
                  <KpiCard
                    label="Mes de mayor gasto"
                    value={totales.mes_pico_etiqueta}
                    caption={totales.mes_pico_costo ? money(totales.mes_pico_costo) : undefined}
                    className="col-span-2"
                  />
                )}
              </section>

              <ChartCard title="Gasto mensual" subtitle="Costo total de pedidos por mes">
                <TrendBars data={trendData} formatValue={moneyShort} />
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Costo por localidad">
                  <RankingBars
                    data={(estadisticas?.por_localidad ?? []).map((row) => ({
                      label: row.localidad_nombre || "Sin localidad",
                      value: Number(row.costo_total),
                      percent: row.porcentaje,
                    }))}
                    formatValue={(value) => money(value)}
                  />
                </ChartCard>
                <ChartCard title="Costo por proveedor">
                  <RankingBars
                    data={(estadisticas?.por_proveedor ?? []).map((row) => ({
                      label: row.proveedor_nombre || "Sin proveedor",
                      value: Number(row.costo_total),
                      hint: row.localidades,
                      percent: row.porcentaje,
                    }))}
                    formatValue={(value) => money(value)}
                  />
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Top ingredientes por costo">
                  <RankingBars
                    data={(estadisticas?.top_ingredientes ?? []).map((row) => ({
                      label: row.ingrediente_nombre,
                      value: Number(row.costo_total),
                      percent: row.porcentaje,
                    }))}
                    formatValue={(value) => money(value)}
                  />
                </ChartCard>
                <ChartCard title="Distribución por tipo de pedido">
                  <DonutChart
                    data={(estadisticas?.por_tipo ?? []).map((row) => ({
                      label: row.tipo_label,
                      value: Number(row.costo_total),
                    }))}
                    formatValue={moneyShort}
                  />
                </ChartCard>
              </div>
            </>
          ) : (
            <EmptyState message="Todavía no hay pedidos generados para estos filtros." />
          )}
        </div>
      )}

      {tab === "mensual" && (
        <div className="space-y-6">
          {mensualError && <ErrorBanner message={mensualError} />}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Mes
                  </label>
                  <select
                    value={selectedMes}
                    onChange={(event) => setSelectedMes(event.target.value)}
                    disabled={meses.length === 0}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 sm:w-64"
                  >
                    {meses.length === 0 && <option value="">Sin meses disponibles</option>}
                    {meses.map((item) => (
                      <option key={mesKey(item)} value={mesKey(item)}>
                        {item.etiqueta} · {item.num_pedidos} ped. · {money(item.costo_total)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Tipo de pedido
                  </label>
                  <select
                    value={tipo}
                    onChange={(event) => setTipo(event.target.value as ReportePedidoTipo)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-48"
                  >
                    {TIPO_FILTERS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadReporte("pdf")}
                  disabled={!reporte || reporte.num_pedidos === 0 || downloading !== null}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {downloading === "pdf" ? "Generando..." : "Descargar PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadReporte("excel")}
                  disabled={!reporte || reporte.num_pedidos === 0 || downloading !== null}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {downloading === "excel" ? "Generando..." : "Descargar Excel"}
                </button>
              </div>
            </div>
          </section>

          {loadingMeses && meses.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Cargando meses...</p>
          ) : meses.length === 0 ? (
            <EmptyState message="Todavía no hay pedidos generados para estos filtros." />
          ) : loadingReporte && !reporte ? (
            <p className="py-10 text-center text-sm text-slate-400">Cargando reporte...</p>
          ) : reporte ? (
            <MensualDetalle reporte={reporte} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  caption,
  accent,
  className,
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        accent ? "border-blue-100 bg-blue-50" : "border-gray-100 bg-white"
      } ${className ?? ""}`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${accent ? "text-blue-800" : "text-slate-900"}`}>{value}</p>
      {caption && <p className="mt-1 text-sm text-slate-500">{caption}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
      {message}
    </p>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function MensualDetalle({ reporte }: { reporte: ReporteMensual }) {
  if (reporte.num_pedidos === 0) {
    return <EmptyState message={`No hay pedidos en ${reporte.etiqueta} para el filtro elegido.`} />;
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Costo total del mes" value={money(reporte.costo_total)} accent className="col-span-2 lg:col-span-1" />
        <KpiCard label="Pedidos incluidos" value={String(reporte.num_pedidos)} />
        <KpiCard label="Proveedores" value={String(reporte.por_proveedor.length)} />
        <KpiCard label="Localidades" value={String(reporte.por_localidad.length)} />
      </section>

      <ChartCard title="Resumen consolidado" subtitle="Cantidades y costos sumados por ingrediente, localidad y proveedor">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Ingrediente</th>
                <th className="px-4 py-3 text-left font-medium">Localidad</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                <th className="px-4 py-3 text-right font-medium">Precio prom.</th>
                <th className="px-4 py-3 text-right font-medium">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reporte.resumen.map((row, index) => (
                <tr key={`${row.ingrediente_id}-${row.localidad_id}-${row.proveedor_id}-${index}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{row.ingrediente_nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{row.localidad_nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{row.proveedor_nombre}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {row.cantidad_total} {row.unidad}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(row.precio_promedio)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{money(row.costo_total)}</td>
                </tr>
              ))}
              {reporte.resumen.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Sin ingredientes con proveedor asignado en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Costo por proveedor">
          <RankingBars
            data={reporte.por_proveedor.map((row) => ({
              label: row.proveedor_nombre || "Sin proveedor",
              value: Number(row.costo_total),
              hint: row.localidades,
              percent: row.porcentaje,
            }))}
            formatValue={(value) => money(value)}
          />
        </ChartCard>
        <ChartCard title="Costo por localidad">
          <RankingBars
            data={reporte.por_localidad.map((row) => ({
              label: row.localidad_nombre || "Sin localidad",
              value: Number(row.costo_total),
              percent: row.porcentaje,
            }))}
            formatValue={(value) => money(value)}
          />
        </ChartCard>
      </div>

      <ChartCard title="Costo por escuela">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Escuela</th>
                <th className="px-4 py-3 text-left font-medium">Localidad</th>
                <th className="px-4 py-3 text-right font-medium">Costo</th>
                <th className="px-4 py-3 text-right font-medium">% del mes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reporte.por_escuela.map((row) => (
                <tr key={row.escuela_id}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {row.codigo ? `${row.codigo} - ` : ""}
                    {row.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.localidad_nombre}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{money(row.costo_total)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.porcentaje}%</td>
                </tr>
              ))}
              {reporte.por_escuela.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Sin costos por escuela en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard title="Pedidos incluidos" subtitle={`${reporte.pedidos.length} pedidos en ${reporte.etiqueta}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Detalle</th>
                <th className="px-4 py-3 text-right font-medium">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reporte.pedidos.map((pedido) => (
                <tr key={pedido.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{pedido.fecha}</td>
                  <td className="px-4 py-3 text-gray-600">{pedido.tipo_label}</td>
                  <td className="px-4 py-3 text-gray-600">{pedido.detalle}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{money(pedido.costo_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
