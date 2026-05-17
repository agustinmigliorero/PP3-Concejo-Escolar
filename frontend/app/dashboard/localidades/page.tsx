"use client";

import { useEffect, useState } from "react";
import {
  apiGetLocalidades,
  apiCreateLocalidad,
  apiUpdateLocalidad,
  apiToggleLocalidadActive,
  type LocalidadRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";

type Tab = "activas" | "inactivas";
type ModalMode = "create" | "edit";

export default function LocalidadesPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [localidades, setLocalidades] = useState<LocalidadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activas");

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirm toggle modal
  const [confirmTarget, setConfirmTarget] = useState<LocalidadRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadLocalidades() {
    setLoading(true);
    try {
      setLocalidades(await apiGetLocalidades());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar localidades");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLocalidades(); }, []);

  function openCreate() {
    setNombre("");
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(loc: LocalidadRecord) {
    setNombre(loc.nombre);
    setFormError(null);
    setModalMode("edit");
    setEditingId(loc.id);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    try {
      if (modalMode === "create") {
        await apiCreateLocalidad(nombre);
      } else if (editingId !== null) {
        await apiUpdateLocalidad(editingId, nombre);
      }
      setModalOpen(false);
      await loadLocalidades();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return;
    setToggling(true);
    try {
      const updated = await apiToggleLocalidadActive(confirmTarget.id);
      setLocalidades((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setConfirmTarget(null);
    } catch {
      setError("Error al cambiar el estado de la localidad");
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  const visible = localidades.filter((l) =>
    tab === "activas" ? l.activo : !l.activo
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Localidades</h1>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nueva localidad
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["activas", "inactivas"] as Tab[]).map((t) => {
          const count = localidades.filter((l) =>
            t === "activas" ? l.activo : !l.activo
          ).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">ID</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                {isAdmin && (
                  <th className="text-right px-5 py-3 font-medium text-gray-500">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((loc) => (
                <tr
                  key={loc.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3 text-gray-400">{loc.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{loc.nombre}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        loc.activo ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    {loc.activo ? "Activa" : "Inactiva"}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {loc.activo && (
                          <button
                            onClick={() => openEdit(loc)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmTarget(loc)}
                          className={`font-medium px-2 py-1 rounded transition-colors ${
                            loc.activo
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {loc.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 4 : 3}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    {tab === "activas"
                      ? "No hay localidades activas."
                      : "No hay localidades inactivas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nueva localidad" : "Editar localidad"}
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Azul, Cacharí, Chillar"
                autoFocus
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
                {formError}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm toggle modal */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              {confirmTarget.activo ? "Desactivar localidad" : "Activar localidad"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              ¿Confirmás que querés{" "}
              <span className="font-medium">
                {confirmTarget.activo ? "desactivar" : "activar"}
              </span>{" "}
              la localidad{" "}
              <span className="font-semibold text-gray-800">
                {confirmTarget.nombre}
              </span>
              ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={toggling}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmToggle}
                disabled={toggling}
                className={`flex-1 font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50 text-white ${
                  confirmTarget.activo
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {toggling
                  ? "Guardando..."
                  : confirmTarget.activo
                  ? "Desactivar"
                  : "Activar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
