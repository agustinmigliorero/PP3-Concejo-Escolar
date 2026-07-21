"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  apiGetSchool,
  apiGetSchoolStock,
  apiUpdateSchoolStock,
  type SchoolRecord,
  type StockPrevioItem,
} from "@/lib/api";
import { showSuccessToast } from "@/components/toast";
import { useUser } from "@/app/dashboard/user-context";

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

function formatStockValue(value: string) {
  return String(Number(value));
}

function parseAsUTC(value: string): Date {
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  return new Date(value + "Z");
}

function formatDate(value: string | null) {
  if (!value) return "Sin carga";
  const date = parseAsUTC(value);
  if (Number.isNaN(date.getTime())) return "Sin carga";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function EscuelaDetallePage() {
  const params = useParams<{ id: string }>();
  const { user } = useUser();
  const canManage = user?.role === "admin" || user?.role === "gestor";
  const schoolId = Number(params.id);

  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [stockItems, setStockItems] = useState<StockPrevioItem[]>([]);
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [stockSaving, setStockSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchoolDetail() {
      if (!canManage || !Number.isInteger(schoolId) || schoolId <= 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [schoolData, stockData] = await Promise.all([
          apiGetSchool(schoolId),
          apiGetSchoolStock(schoolId),
        ]);
        setSchool(schoolData);
        setStockItems(stockData.items);
        setStockDraft(
          Object.fromEntries(
            stockData.items.map((item) => [
              item.ingrediente_id,
              formatStockValue(item.cantidad),
            ]),
          ),
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar la escuela");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadSchoolDetail();
    }
  }, [canManage, schoolId, user]);

  async function handleSaveStock() {
    if (!school) return;

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
      const updated = await apiUpdateSchoolStock(school.id, items);
      setStockItems(updated.items);
      setStockDraft(
        Object.fromEntries(
          updated.items.map((item) => [
            item.ingrediente_id,
            formatStockValue(item.cantidad),
          ]),
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

  if (user && !canManage) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No tenes permisos para ver esta seccion.
        </p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          Escuela invalida.
        </p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard/escuelas"
          className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-900 mb-4"
        >
          Volver a escuelas
        </Link>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error ?? "No se encontro la escuela."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/dashboard/escuelas"
        className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-900 mb-4"
      >
        Volver a escuelas
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{school.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {school.code} - {school.locality_name}
          </p>
        </div>
        <span
          className={`w-fit text-xs font-medium px-2 py-1 rounded-full ${
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
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold text-gray-800">Informacion general</h2>
          <Link
            href="/dashboard/escuelas"
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Editar datos desde listado
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailField label="Nombre" value={school.name} />
          <DetailField label="Codigo" value={school.code} />
          <DetailField label="Localidad" value={school.locality_name} />
          <DetailField label="Direccion" value={school.address} />
          <DetailField label="Telefono" value={school.phone ?? "—"} />
          <DetailField label="Email" value={school.email ?? "—"} />
          <DetailField
            label="Matricula"
            value={school.matriculation.toLocaleString("es-AR")}
          />
          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 md:col-span-2">
            <p className="text-xs uppercase tracking-wide font-medium text-gray-500 mb-2">
              Comidas
            </p>
            <div className="flex flex-wrap gap-2">
              {school.tipos_comida.length > 0 ? (
                school.tipos_comida.map((tipo) => (
                  <span
                    key={tipo.id}
                    className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full"
                  >
                    {tipo.nombre}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">Sin comidas cargadas</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Stock sobrante</h2>
            <p className="text-sm text-gray-500 mt-1">
              Cantidades disponibles para descontar del proximo pedido.
            </p>
            {!school.active && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                La escuela esta inactiva. El stock se puede ver, pero no guardar.
              </p>
            )}
          </div>
          <button
            onClick={handleSaveStock}
            disabled={stockSaving || stockItems.length === 0 || !school.active}
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
                  <th className="text-left font-medium px-4 py-3">Ultima carga</th>
                  <th className="text-left font-medium px-4 py-3 w-44">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {stockItems.map((item) => {
                    const recent = canManage && Number(stockDraft[item.ingrediente_id] ?? "0") > 0 && (Number(item.previous_cantidad) !== Number(stockDraft[item.ingrediente_id]));
                    return (
                    <tr key={item.ingrediente_id} className={recent ? "bg-amber-50/60" : ""}>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      <span className="flex items-center gap-2">
                        {item.ingrediente_nombre}
                        {recent && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 rounded">
                            Nuevo
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.unidad_medida}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(item.cargado_at)}
                    </td>
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
                        disabled={!school.active}
                        className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </td>
                    </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
