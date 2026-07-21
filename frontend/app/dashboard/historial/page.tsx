"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type NotificationRecord,
  apiGetNotifications,
} from "@/lib/api";

const TYPE_LABEL: Record<string, string> = {
  stock_cargado: "Stock sobrante",
  matricula_actualizada: "Matrícula",
};

function parseAsUTC(value: string): Date {
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  return new Date(value + "Z");
}

function formatDateTime(value: string) {
  const date = parseAsUTC(value);
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

interface StockItem {
  nombre: string;
  unidad_medida?: string;
  cantidad: string;
  cantidad_anterior?: string;
  actualizado?: boolean;
}

function StockDetailModal({
  notification,
  onClose,
}: {
  notification: NotificationRecord;
  onClose: () => void;
}) {
  const items = (notification.details as StockItem[]) ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Detalle de carga</h2>
        <p className="text-sm text-gray-500 mb-4">
          {notification.escuela_nombre ?? "Escuela"} · {formatDateTime(notification.created_at)}
        </p>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left py-2 font-medium">Ingrediente</th>
                <th className="text-left py-2 font-medium">Previo</th>
                <th className="text-right py-2 font-medium">Nuevo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className={`border-b border-gray-50 ${Number(item.cantidad) > 0 && Number(item.cantidad_anterior) !== Number(item.cantidad) ? "bg-blue-50" : ""}`}>
                  <td className="py-2 text-gray-800 font-medium">
                    {item.nombre}
                    {Number(item.cantidad) > 0 && Number(item.cantidad_anterior) !== Number(item.cantidad) && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-600">
                        MODIFICADO
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-left text-gray-500">
                    {item.cantidad_anterior ?? "—"}{item.unidad_medida ? ` ${item.unidad_medida}` : ""}
                  </td>
                  <td className="py-2 text-right text-gray-800">
                    {item.cantidad}{item.unidad_medida ? ` ${item.unidad_medida}` : ""}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-gray-400">
                    Sin detalles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="border border-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HistorialPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<NotificationRecord | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetNotifications();
        setNotifications(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar el historial");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Historial</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : notifications.length === 0 ? (
          <p className="text-gray-400 text-sm p-6">No hay modificaciones registradas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Detalle</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Escuela</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Usuario</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      n.type === "stock_cargado"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700 max-w-md">
                    {n.type === "stock_cargado" ? (
                      <button
                        onClick={() => setDetailTarget(n)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm hover:underline"
                      >
                        Ver detalle
                      </button>
                    ) : n.type === "matricula_actualizada" ? (
                      <span className="text-gray-600">
                        {n.details && (n.details as Record<string, unknown>).old_value !== undefined
                          ? `De ${(n.details as Record<string, unknown>).old_value} a `
                          : ""}
                        <span className="font-medium text-gray-800">
                          {(n.details as Record<string, unknown>)?.new_value as string}
                        </span>{" "}
                        alumnos
                      </span>
                    ) : (
                      <span className="truncate block">{n.message}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {n.escuela_id ? (
                      <Link
                        href={`/dashboard/escuelas/${n.escuela_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {n.escuela_nombre ?? `Escuela #${n.escuela_id}`}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {n.cargado_por_username ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateTime(n.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailTarget && (
        <StockDetailModal
          notification={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}
