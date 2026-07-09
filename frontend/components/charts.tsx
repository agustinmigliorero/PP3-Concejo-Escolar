"use client";

// Graficos ligeros sin dependencias externas (el proyecto no incluye libreria
// de charts). Todos son responsivos: barras con fl/CSS y el donut con SVG por
// viewBox. Pensados para el panel de Reportes y estadisticas.

export const CHART_PALETTE = [
  "#1f5eff",
  "#14804a",
  "#b7791f",
  "#c93636",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#0d9488",
];

export function colorAt(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

type TrendPoint = {
  label: string;
  value: number;
  caption?: string;
};

export function TrendBars({
  data,
  formatValue,
  emptyLabel = "Sin datos para mostrar",
}: {
  data: TrendPoint[];
  formatValue: (value: number) => string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((point) => point.value), 0);

  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: "12rem" }}>
      {data.map((point, index) => {
        const heightPct = max > 0 ? Math.max((point.value / max) * 100, point.value > 0 ? 3 : 0) : 0;
        return (
          <div
            key={`${point.label}-${index}`}
            className="flex min-w-[3.25rem] flex-1 flex-col items-center gap-2"
            title={`${point.label}: ${formatValue(point.value)}`}
          >
            <span className="text-[11px] font-semibold text-slate-500">
              {formatValue(point.value)}
            </span>
            <div className="flex h-40 w-full items-end justify-center">
              <div
                className="w-full max-w-[2.75rem] rounded-t-md bg-blue-600 transition-all"
                style={{ height: `${heightPct}%`, backgroundColor: "var(--brand)" }}
              />
            </div>
            <span className="max-w-[4.5rem] text-center text-[11px] leading-tight text-slate-500">
              {point.label}
            </span>
            {point.caption && (
              <span className="text-[10px] text-slate-400">{point.caption}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type RankingRow = {
  label: string;
  value: number;
  hint?: string;
  percent?: number;
};

export function RankingBars({
  data,
  formatValue,
  emptyLabel = "Sin datos para mostrar",
}: {
  data: RankingRow[];
  formatValue: (value: number) => string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((row) => row.value), 0);

  return (
    <ul className="space-y-3">
      {data.map((row, index) => {
        const widthPct = max > 0 ? Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0) : 0;
        return (
          <li key={`${row.label}-${index}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-slate-700" title={row.label}>
                {row.label}
                {row.hint && <span className="ml-1 text-xs text-slate-400">{row.hint}</span>}
              </span>
              <span className="shrink-0 text-sm font-semibold text-slate-900">
                {formatValue(row.value)}
                {row.percent != null && (
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    {row.percent}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: colorAt(index) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type DonutSlice = {
  label: string;
  value: number;
};

export function DonutChart({
  data,
  formatValue,
  emptyLabel = "Sin datos para mostrar",
}: {
  data: DonutSlice[];
  formatValue: (value: number) => string;
  emptyLabel?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // Offsets acumulados calculados con sumas de prefijo puras (sin mutar
  // variables durante el render). El donut tiene pocos segmentos (tipos de
  // pedido), asi que el costo O(n^2) es irrelevante.
  const offsets = data.map((_, index) =>
    data.slice(0, index).reduce((sum, prev) => sum + (prev.value / total) * circumference, 0),
  );

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label="Distribución por tipo">
        <g transform="rotate(-90 80 80)">
          {data.map((slice, index) => {
            const dash = (slice.value / total) * circumference;
            return (
              <circle
                key={`${slice.label}-${index}`}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={colorAt(index)}
                strokeWidth="24"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offsets[index]}
              />
            );
          })}
        </g>
        <text x="80" y="76" textAnchor="middle" className="fill-slate-500" style={{ fontSize: "9px" }}>
          Total
        </text>
        <text x="80" y="92" textAnchor="middle" className="fill-slate-900" style={{ fontSize: "12px", fontWeight: 700 }}>
          {formatValue(total)}
        </text>
      </svg>
      <ul className="w-full space-y-2">
        {data.map((slice, index) => (
          <li key={`${slice.label}-legend-${index}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: colorAt(index) }}
              />
              <span className="truncate text-slate-600">{slice.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-slate-900">
              {formatValue(slice.value)}
              <span className="ml-1 text-xs font-normal text-slate-400">
                {Math.round((slice.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
