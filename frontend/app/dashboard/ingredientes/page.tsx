"use client";

import { useEffect, useState } from "react";
import {
  apiGetIngredientes,
  apiCreateIngrediente,
  apiUpdateIngrediente,
  apiToggleIngredienteActive,
  type IngredienteRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";

type Tab = "activos" | "inactivos";
type ModalMode = "create" | "edit";

export default function IngredientesPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [ingredientes, setIngredientes] = useState<IngredienteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activos");

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("");
  const [contenidoPorUnidad, setContenidoPorUnidad] = useState("");
  const [unidadContenido, setUnidadContenido] = useState("");
  const [indiceCorreccion, setIndiceCorreccion] = useState("1.0");

  // Confirm toggle modal
  const [confirmTarget, setConfirmTarget] = useState<IngredienteRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadIngredientes() {
    setLoading(true);
    try {
      setIngredientes(await apiGetIngredientes(true));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar ingredientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadIngredientes(); }, []);

  function openCreate() {
    setNombre("");
    setUnidadMedida("kg");
    setContenidoPorUnidad("");
    setUnidadContenido("");
    setIndiceCorreccion("1.0");
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(ing: IngredienteRecord) {
    setNombre(ing.nombre);
    setUnidadMedida(ing.unidad_medida);
    setContenidoPorUnidad(ing.contenido_por_unidad?.toString() || "");
    setUnidadContenido(ing.unidad_contenido || "");
    setIndiceCorreccion(ing.indice_correccion.toString());
    setFormError(null);
    setModalMode("edit");
    setEditingId(ing.id);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    
    try {
      const data = {
        nombre,
        unidad_medida: unidadMedida,
        contenido_por_unidad: contenidoPorUnidad ? parseFloat(contenidoPorUnidad) : null,
        unidad_contenido: unidadContenido || null,
        indice_correccion: parseFloat(indiceCorreccion) || 1.0
      };

      if (modalMode === "create") {
        await apiCreateIngrediente(data);
      } else if (editingId !== null) {
        await apiUpdateIngrediente(editingId, data);
      }
      setModalOpen(false);
      await loadIngredientes();
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
      const updated = await apiToggleIngredienteActive(confirmTarget.id);
      setIngredientes((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setConfirmTarget(null);
    } catch {
      setError("Error al cambiar el estado del ingrediente");
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  const visible = ingredientes.filter((i) =>
    tab === "activos" ? i.activo : !i.activo
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Ingredientes</h1>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo ingrediente
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
        {(["activos", "inactivos"] as Tab[]).map((t) => {
          const count = ingredientes.filter((i) =>
            t === "activos" ? i.activo : !i.activo
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">ID</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Unidad</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Contenido/Unidad</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Índice Corr.</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                  {isAdmin && (
                    <th className="text-right px-5 py-3 font-medium text-gray-500">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((ing) => (
                  <tr
                    key={ing.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-400">{ing.id}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{ing.nombre}</td>
                    <td className="px-5 py-3 text-gray-600">{ing.unidad_medida}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {ing.unidad_medida === "unidades" && ing.contenido_por_unidad
                        ? `${ing.contenido_por_unidad} ${ing.unidad_contenido || ""}`
                        : "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{ing.indice_correccion}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          ing.activo ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      {ing.activo ? "Activo" : "Inactivo"}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {ing.activo && (
                            <button
                              onClick={() => openEdit(ing)}
                              className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmTarget(ing)}
                            className={`font-medium px-2 py-1 rounded transition-colors ${
                              ing.activo
                                ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                                : "text-green-600 hover:text-green-800 hover:bg-green-50"
                            }`}
                          >
                            {ing.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 7 : 6}
                      className="px-5 py-8 text-center text-gray-400"
                    >
                      {tab === "activos"
                        ? "No hay ingredientes activos."
                        : "No hay ingredientes inactivos."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nuevo ingrediente" : "Editar ingrediente"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Fideos tirabuzón, Pollo con hueso"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidad de medida
                </label>
                <select
                  value={unidadMedida}
                  onChange={(e) => setUnidadMedida(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kg">kg</option>
                  <option value="gs">gs</option>
                  <option value="litros">litros</option>
                  <option value="ml">ml</option>
                  <option value="cc">cc</option>
                  <option value="unidades">unidades</option>
                  <option value="docenas">docenas</option>
                </select>
              </div>

              {unidadMedida === "unidades" && (
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-2">
                      Para ingredientes por unidad, definí cuánto trae cada unidad comercial.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contenido
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={contenidoPorUnidad}
                      onChange={(e) => setContenidoPorUnidad(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: 900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unidad del contenido
                    </label>
                    <select
                      value={unidadContenido}
                      onChange={(e) => setUnidadContenido(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="ml">ml</option>
                      <option value="gs">gs</option>
                      <option value="cc">cc</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Índice de corrección (desperdicios)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={indiceCorreccion}
                  onChange={(e) => setIndiceCorreccion(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 1.0 (sin desperdicio), 1.68 (pollo)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Por defecto es 1.0. Se multiplica por la cantidad base a pedir.
                </p>
              </div>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              {confirmTarget.activo ? "Desactivar ingrediente" : "Activar ingrediente"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              ¿Confirmás que querés{" "}
              <span className="font-medium">
                {confirmTarget.activo ? "desactivar" : "activar"}
              </span>{" "}
              el ingrediente{" "}
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
