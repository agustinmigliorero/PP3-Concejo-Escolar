"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiCreateTipoComida,
  apiGetTiposComida,
  apiToggleTipoComidaActive,
  apiUpdateTipoComida,
  type TipoComidaRecord,
} from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/components/toast";

type Tab = "activos" | "inactivos";
type ModalMode = "create" | "edit";

export default function TiposComidaPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [tipos, setTipos] = useState<TipoComidaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activos");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<TipoComidaRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetTiposComida(true);
      setTipos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar tipos de comida");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const visibleTipos = useMemo(
    () => tipos.filter((tipo) => (tab === "activos" ? tipo.activo : !tipo.activo)),
    [tipos, tab],
  );

  if (!currentUser) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Tipos de comida</h1>
          <p className="text-sm text-gray-500">
            Solo el perfil administrador puede gestionar los tipos de comida.
          </p>
        </div>
      </div>
    );
  }

  function openCreate() {
    setNombre("");
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(tipo: TipoComidaRecord) {
    setNombre(tipo.nombre);
    setFormError(null);
    setModalMode("edit");
    setEditingId(tipo.id);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    const trimmed = nombre.trim();
    if (trimmed.length < 2) {
      setFormError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        await apiCreateTipoComida({ nombre: trimmed });
        showSuccessToast("Tipo de comida creado correctamente");
      } else if (editingId !== null) {
        await apiUpdateTipoComida(editingId, { nombre: trimmed });
        showSuccessToast("Tipo de comida actualizado correctamente");
      }
      setModalOpen(false);
      await loadData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar el tipo de comida");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return;

    setToggling(true);
    try {
      const updated = await apiToggleTipoComidaActive(confirmTarget.id);
      setTipos((prev) => prev.map((tipo) => (tipo.id === updated.id ? updated : tipo)));
      setConfirmTarget(null);
      showSuccessToast(
        updated.activo
          ? "Tipo de comida activado correctamente"
          : "Tipo de comida desactivado correctamente",
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Error al cambiar el estado del tipo de comida";
      setError(message);
      showErrorToast(message);
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tipos de comida</h1>
          <p className="text-sm text-gray-500 mt-1">
            Desayuno, almuerzo, merienda y los que quieras agregar. Se usan en recetas, menús y escuelas.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo tipo
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["activos", "inactivos"] as Tab[]).map((currentTab) => {
          const count = tipos.filter((tipo) =>
            currentTab === "activos" ? tipo.activo : !tipo.activo,
          ).length;

          return (
            <button
              key={currentTab}
              onClick={() => setTab(currentTab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === currentTab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {currentTab === "activos" ? "Activos" : "Inactivos"}
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === currentTab
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">ID</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleTipos.map((tipo) => (
                  <tr
                    key={tipo.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-400">{tipo.id}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{tipo.nombre}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          tipo.activo ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      {tipo.activo ? "Activo" : "Inactivo"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {tipo.activo && (
                          <button
                            onClick={() => openEdit(tipo)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmTarget(tipo)}
                          className={`font-medium px-2 py-1 rounded transition-colors ${
                            tipo.activo
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {tipo.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleTipos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                      {tab === "activos"
                        ? "No hay tipos de comida activos."
                        : "No hay tipos de comida inactivos."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nuevo tipo de comida" : "Editar tipo de comida"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Cena"
                  autoFocus
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              {confirmTarget.activo ? "Desactivar tipo de comida" : "Activar tipo de comida"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              ¿Querés {confirmTarget.activo ? "desactivar" : "activar"} el tipo{" "}
              <span className="font-medium text-gray-800">{confirmTarget.nombre}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmToggle}
                disabled={toggling}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors text-white ${
                  confirmTarget.activo
                    ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                    : "bg-green-600 hover:bg-green-700 disabled:bg-green-300"
                }`}
              >
                {toggling
                  ? "Procesando..."
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
