"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiCreateReceta,
  apiGetIngredientes,
  apiGetRecetas,
  apiGetTemporadas,
  apiGetTiposComida,
  apiToggleRecetaActive,
  apiUpdateReceta,
  type IngredienteRecord,
  type RecetaRecord,
  type TemporadaRecord,
  type TipoComidaRecord,
} from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/components/toast";
import {
  getRecipeUnitConfig,
  toRecipeQuantity,
  toStoredQuantity,
} from "@/lib/units";

type Tab = "activas" | "inactivas";
type ModalMode = "create" | "edit";

interface FormIngredient {
  tempId: string;
  ingrediente_id: string;
  cantidad_por_porcion: string;
}

interface FormState {
  nombre: string;
  tipos_comida_ids: number[];
  temporada_id: string;
  ingredientes: FormIngredient[];
}

function createTempId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createIngredientRow(): FormIngredient {
  return {
    tempId: createTempId(),
    ingrediente_id: "",
    cantidad_por_porcion: "",
  };
}

function createEmptyForm(): FormState {
  return {
    nombre: "",
    tipos_comida_ids: [],
    temporada_id: "",
    ingredientes: [createIngredientRow()],
  };
}

export default function RecetasPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [recetas, setRecetas] = useState<RecetaRecord[]>([]);
  const [ingredientes, setIngredientes] = useState<IngredienteRecord[]>([]);
  const [temporadas, setTemporadas] = useState<TemporadaRecord[]>([]);
  const [tiposComida, setTiposComida] = useState<TipoComidaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activas");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<RecetaRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [recetasData, ingredientesData, temporadasData, tiposData] = await Promise.all([
        apiGetRecetas(true),
        apiGetIngredientes(true),
        apiGetTemporadas(true),
        apiGetTiposComida(),
      ]);
      setRecetas(recetasData);
      setIngredientes(ingredientesData);
      setTemporadas(temporadasData);
      setTiposComida(tiposData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar recetas");
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

  const visibleRecetas = useMemo(
    () => recetas.filter((receta) => (tab === "activas" ? receta.activo : !receta.activo)),
    [recetas, tab],
  );
  const ingredientesById = useMemo(
    () => new Map(ingredientes.map((ingrediente) => [ingrediente.id, ingrediente])),
    [ingredientes],
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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Recetas</h1>
          <p className="text-sm text-gray-500">
            Solo el perfil administrador puede cargar y modificar recetas.
          </p>
        </div>
      </div>
    );
  }

  function resetForm() {
    setForm(createEmptyForm());
  }

  function openCreate() {
    resetForm();
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(receta: RecetaRecord) {
    setForm({
      nombre: receta.nombre,
      tipos_comida_ids: receta.tipos_comida.map((tipo) => tipo.id),
      temporada_id: receta.temporada_id ? String(receta.temporada_id) : "",
      ingredientes: receta.ingredientes.map((item) => ({
        tempId: createTempId(),
        ingrediente_id: String(item.ingrediente_id),
        cantidad_por_porcion: String(
          toRecipeQuantity(
            Number(item.cantidad_por_porcion),
            ingredientesById.get(item.ingrediente_id) ?? item,
          ),
        ),
      })),
    });
    setFormError(null);
    setModalMode("edit");
    setEditingId(receta.id);
    setModalOpen(true);
  }

  function updateIngredientRow(
    tempId: string,
    patch: Partial<FormIngredient>,
  ) {
    setForm((prev) => ({
      ...prev,
      ingredientes: prev.ingredientes.map((item) =>
        item.tempId === tempId ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addIngredientRow() {
    setForm((prev) => ({
      ...prev,
      ingredientes: [...prev.ingredientes, createIngredientRow()],
    }));
  }

  function removeIngredientRow(tempId: string) {
    setForm((prev) => ({
      ...prev,
      ingredientes:
        prev.ingredientes.length === 1
          ? prev.ingredientes
          : prev.ingredientes.filter((item) => item.tempId !== tempId),
    }));
  }

  function recipeUnitFor(ingredienteId: string): string | null {
    const ingrediente = ingredientesById.get(Number(ingredienteId));
    return ingrediente ? getRecipeUnitConfig(ingrediente).recipeUnit : null;
  }

  function orderUnitFor(ingredienteId: string): string | null {
    const ingrediente = ingredientesById.get(Number(ingredienteId));
    return ingrediente ? getRecipeUnitConfig(ingrediente).orderUnit : null;
  }

  async function handleSave() {
    setFormError(null);

    if (!form.nombre.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    const temporadaId = Number(form.temporada_id);
    if (!temporadaId) {
      setFormError("Seleccioná una temporada");
      return;
    }

    if (form.tipos_comida_ids.length === 0) {
      setFormError("Seleccioná al menos un tipo de comida");
      return;
    }

    const cleanedIngredients = form.ingredientes.map((item) => {
      const ingredienteId = Number(item.ingrediente_id);
      const ingrediente = ingredientesById.get(ingredienteId);
      const cantidadReceta = Number(item.cantidad_por_porcion);

      return {
        ingrediente_id: ingredienteId,
        cantidad_por_porcion: ingrediente
          ? toStoredQuantity(cantidadReceta, ingrediente)
          : Number.NaN,
      };
    });

    if (
      cleanedIngredients.some(
        (item) => !item.ingrediente_id || Number.isNaN(item.cantidad_por_porcion) || item.cantidad_por_porcion <= 0,
      )
    ) {
      setFormError("Completá todos los ingredientes con una cantidad por porción mayor a 0");
      return;
    }

    const uniqueIds = new Set(cleanedIngredients.map((item) => item.ingrediente_id));
    if (uniqueIds.size !== cleanedIngredients.length) {
      setFormError("No se puede repetir un ingrediente dentro de la receta");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipos_comida_ids: form.tipos_comida_ids,
        temporada_id: temporadaId,
        ingredientes: cleanedIngredients,
      };

      if (modalMode === "create") {
        await apiCreateReceta(payload);
        showSuccessToast("Receta creada correctamente");
      } else if (editingId !== null) {
        await apiUpdateReceta(editingId, payload);
        showSuccessToast("Receta actualizada correctamente");
      }

      setModalOpen(false);
      await loadData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar receta");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return;

    setToggling(true);
    try {
      const updated = await apiToggleRecetaActive(confirmTarget.id);
      setRecetas((prev) => prev.map((receta) => (receta.id === updated.id ? updated : receta)));
      setConfirmTarget(null);
      showSuccessToast(
        updated.activo
          ? "Receta activada correctamente"
          : "Receta desactivada correctamente",
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Error al cambiar el estado de la receta";
      setError(message);
      showErrorToast(message);
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Recetas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cada receta consume ingredientes y queda lista para asociarse a temporadas y menús.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva receta
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["activas", "inactivas"] as Tab[]).map((currentTab) => {
          const count = recetas.filter((receta) =>
            currentTab === "activas" ? receta.activo : !receta.activo,
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
              {currentTab === "activas" ? "Activas" : "Inactivas"}
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
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Tipo de comida</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Temporada</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Ingredientes</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecetas.map((receta) => (
                  <tr
                    key={receta.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-400">{receta.id}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{receta.nombre}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {receta.tipos_comida.length > 0 ? (
                          receta.tipos_comida.map((tipo) => (
                            <span
                              key={tipo.id}
                              className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1"
                            >
                              {tipo.nombre}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">Sin tipos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {receta.temporada_nombre && receta.temporada_anio
                        ? `${receta.temporada_nombre === "VERANO" ? "Verano" : "Invierno"} ${receta.temporada_anio}`
                        : "Sin temporada"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <div className="max-w-md">
                        <p className="font-medium text-gray-700 mb-1">
                          {receta.ingredientes.length} ingrediente{receta.ingredientes.length !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {receta.ingredientes
                            .map((item) => {
                              const ingrediente = ingredientesById.get(item.ingrediente_id) ?? item;
                              const { recipeUnit } = getRecipeUnitConfig(ingrediente);
                              const cantidad = toRecipeQuantity(
                                Number(item.cantidad_por_porcion),
                                ingrediente,
                              );
                              return `${item.ingrediente_nombre} (${cantidad} ${recipeUnit})`;
                            })
                            .join(" · ")}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          receta.activo ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      {receta.activo ? "Activa" : "Inactiva"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {receta.activo && (
                          <button
                            onClick={() => openEdit(receta)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmTarget(receta)}
                          className={`font-medium px-2 py-1 rounded transition-colors ${
                            receta.activo
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {receta.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleRecetas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                      {tab === "activas"
                        ? "No hay recetas activas."
                        : "No hay recetas inactivas."}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nueva receta" : "Editar receta"}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nombre: event.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Fideos con estofado"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temporada
                  </label>
                  <select
                    value={form.temporada_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        temporada_id: event.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar temporada</option>
                    {temporadas.map((temporada) => (
                      <option key={temporada.id} value={temporada.id}>
                        {(temporada.nombre === "VERANO" ? "Verano" : "Invierno")} {temporada.anio}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipos de comida
                </label>
                {tiposComida.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No hay tipos de comida activos. Creá uno en la sección &quot;Tipos de comida&quot;.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {tiposComida.map((tipo) => {
                      const checked = form.tipos_comida_ids.includes(tipo.id);
                      return (
                        <label
                          key={tipo.id}
                          className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                tipos_comida_ids: event.target.checked
                                  ? [...prev.tipos_comida_ids, tipo.id]
                                  : prev.tipos_comida_ids.filter((id) => id !== tipo.id),
                              }))
                            }
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{tipo.nombre}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">
                      Ingredientes de la receta
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Cargá la cantidad por porción estándar para cada ingrediente.
                    </p>
                  </div>
                  <button
                    onClick={addIngredientRow}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    + Agregar ingrediente
                  </button>
                </div>

                <div className="space-y-3">
                  {form.ingredientes.map((item, index) => (
                    <div
                      key={item.tempId}
                      className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_200px_88px] gap-3 items-end"
                    >
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Ingrediente {index + 1}
                        </label>
                        <select
                          value={item.ingrediente_id}
                          onChange={(event) =>
                            updateIngredientRow(item.tempId, {
                              ingrediente_id: event.target.value,
                              cantidad_por_porcion: "",
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Seleccionar ingrediente</option>
                          {ingredientes.map((ingrediente) => (
                            <option
                              key={ingrediente.id}
                              value={ingrediente.id}
                              disabled={!ingrediente.activo}
                            >
                              {ingrediente.nombre} (receta: {getRecipeUnitConfig(ingrediente).recipeUnit}; pedido: {getRecipeUnitConfig(ingrediente).orderUnit}){ingrediente.activo ? "" : " - inactivo"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Cantidad por porción
                        </label>
                        <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.cantidad_por_porcion}
                            onChange={(event) =>
                              updateIngredientRow(item.tempId, {
                                cantidad_por_porcion: event.target.value,
                              })
                            }
                            className="w-full min-w-0 rounded-l-lg px-3 py-2 text-sm focus:outline-none"
                            placeholder="0"
                          />
                          <span className="flex items-center border-l border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 rounded-r-lg">
                            {recipeUnitFor(item.ingrediente_id) ?? "unidad"}
                          </span>
                        </div>
                        {recipeUnitFor(item.ingrediente_id) &&
                          recipeUnitFor(item.ingrediente_id) !== orderUnitFor(item.ingrediente_id) && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              El pedido se calcula en {orderUnitFor(item.ingrediente_id)}.
                            </p>
                          )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeIngredientRow(item.tempId)}
                        disabled={form.ingredientes.length === 1}
                        className="h-10 text-sm font-medium text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
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
              {confirmTarget.activo ? "Desactivar receta" : "Activar receta"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              ¿Querés {confirmTarget.activo ? "desactivar" : "activar"} la receta{" "}
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
