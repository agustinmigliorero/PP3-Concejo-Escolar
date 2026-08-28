// Wrapper presentacional puro extraído de escuelas/[id], mi-escuela y escuelas.

export function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
      <p className="text-xs uppercase tracking-wide font-medium text-gray-500 mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
