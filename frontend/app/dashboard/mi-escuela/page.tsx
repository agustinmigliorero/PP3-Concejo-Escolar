"use client";

import { useEffect, useState } from "react";
import {
  apiGetMySchool,
  apiGetMyStock,
  apiUpdateMyStock,
  apiUpdateMySchoolMatriculation,
  type SchoolRecord,
  type StockPrevioItem,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";

const MEALS: { key: keyof SchoolRecord; label: string }[] = [
  { key: "offers_breakfast", label: "Desayuno" },
  { key: "offers_lunch", label: "Almuerzo" },
  { key: "offers_snack", label: "Merienda" },
];

function DetailField({
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

export default function MiEscuelaPage() {
  const { user } = useUser();
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [matriculation, setMatriculation] = useState("");
  const [stockItems, setStockItems] = useState<StockPrevioItem[]>([]);
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stockSaving, setStockSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadSchool() {
    setLoading(true);
    setError(null);
    try {
      const [data, stock] = await Promise.all([apiGetMySchool(), apiGetMyStock()]);
      setSchool(data);
      setMatriculation(String(data.matriculation));
      setStockItems(stock.items);
      setStockDraft(
        Object.fromEntries(
          stock.items.map((item) => [item.ingrediente_id, String(Number(item.cantidad))]),
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar la escuela");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "escuela") {
      loadSchool();
    } else if (user) {
      setLoading(false);
    }
  }, [user]);

  async function handleSave() {
    const nextMatriculation = Number(matriculation);
    setError(null);
    setSuccess(null);

    if (!Number.isInteger(nextMatriculation) || nextMatriculation < 0) {
      setError("La matricula debe ser un numero entero mayor o igual a 0");
      return;
    }

    setSaving(true);
    try {
      const updated = await apiUpdateMySchoolMatriculation(nextMatriculation);
      setSchool(updated);
      setMatriculation(String(updated.matriculation));
      setSuccess("Matricula actualizada correctamente");
      showSuccessToast("Matricula actualizada correctamente");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar la matricula");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStock() {
    setError(null);
    setSuccess(null);

    const items = stockItems.map((item) => {
      const rawValue = stockDraft[item.ingrediente_id] ?? "0";
      const cantidad = Number(rawValue);
      return { ingrediente_id: item.ingrediente_id, cantidad };
    });

    const invalidItem = items.find(
      (item) => !Number.isFinite(item.cantidad) || item.cantidad < 0,
    );
    if (invalidItem) {
      setError("El stock debe ser un numero mayor o igual a 0");
      return;
    }

    setStockSaving(true);
    try {
      const updated = await apiUpdateMyStock(items);
      setStockItems(updated.items);
      setStockDraft(
        Object.fromEntries(
          updated.items.map((item) => [item.ingrediente_id, String(Number(item.cantidad))]),
        ),
      );
      setSuccess("Stock sobrante actualizado correctamente");
      showSuccessToast("Stock sobrante actualizado correctamente");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar el stock sobrante");
    } finally {
      setStockSaving(false);
    }
  }

  if (user && user.role !== "escuela") {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No tenes permisos para ver esta seccion.
        </p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error ?? "No hay una escuela asociada a este usuario."}
        </p>
      </div>
    );
  }

  const activeMeals = MEALS.filter((meal) => Boolean(school[meal.key]));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Escuela</h1>
          <p className="text-sm text-gray-500 mt-1">
            {school.code} - {school.name}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            school.active
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {school.active ? "Activa" : "Inactiva"}
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4">
          {success}
        </p>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <DetailField label="Nombre" value={school.name} />
          <DetailField label="Codigo" value={school.code} />
          <DetailField label="Localidad" value={school.locality_name} />
          <DetailField label="Direccion" value={school.address} />
          <DetailField label="Telefono" value={school.phone} />
          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
            <p className="text-xs uppercase tracking-wide font-medium text-gray-500 mb-2">
              Comidas
            </p>
            <div className="flex flex-wrap gap-2">
              {activeMeals.length > 0 ? (
                activeMeals.map((meal) => (
                  <span
                    key={meal.key}
                    className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full"
                  >
                    {meal.label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">Sin comidas cargadas</span>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Matricula
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              min={0}
              step={1}
              value={matriculation}
              onChange={(e) => setMatriculation(e.target.value)}
              className="w-full sm:w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? "Guardando..." : "Guardar matricula"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Stock sobrante</h2>
            <p className="text-sm text-gray-500 mt-1">
              Cantidades disponibles para descontar del proximo pedido.
            </p>
          </div>
          <button
            onClick={handleSaveStock}
            disabled={stockSaving || stockItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {stockSaving ? "Guardando..." : "Guardar stock"}
          </button>
        </div>

        {stockItems.length === 0 ? (
          <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg px-4 py-8 text-center">
            No hay ingredientes activos para cargar stock.
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Ingrediente</th>
                  <th className="text-left font-medium px-4 py-3">Unidad</th>
                  <th className="text-left font-medium px-4 py-3 w-44">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockItems.map((item) => (
                  <tr key={item.ingrediente_id}>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {item.ingrediente_nombre}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.unidad_medida}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={stockDraft[item.ingrediente_id] ?? "0"}
                        onChange={(e) =>
                          setStockDraft((current) => ({
                            ...current,
                            [item.ingrediente_id]: e.target.value,
                          }))
                        }
                        className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
