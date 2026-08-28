"use client";

/**
 * Tarjeta KPI de estado extraída textualmente de reportes (Fase 10). Presentacional.
 */
export function KpiCard({
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