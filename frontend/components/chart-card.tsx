"use client";

/**
 * Tarjeta de sección de gráfico extraída textualmente de reportes (Fase 10). Presentacional.
 */
export function ChartCard({
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