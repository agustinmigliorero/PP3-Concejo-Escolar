"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiCreateReceta,
  apiGetIngredientes,
  apiGetRecetas,
  apiGetTemporadas,
  apiToggleRecetaActive,
  apiUpdateReceta,
  type IngredienteRecord,
  type RecetaRecord,
  type TemporadaRecord,
  type TipoComida,
} from "@/lib/api";

type Tab = "activas" | "inactivas";
type ModalMode = "create" | "edit";

const TIPO_COMIDA_LABEL: Record<TipoComida, string> = {
  DESAYUNO: "Desayuno",
  ALMUERZO: "Almuerzo",
  MERIENDA: "Merienda",
};

interface FormIngredient {
  tempId: string;
  ingrediente_id: string;
  cantidad_por_porcion: string;
}

interface FormState {
  nombre: string;
  tipo_comida: TipoComida;
  temporada_id: string;
  ingredientes: FormIngredient[];
}

const EMPTY_FORM: FormState = {
  nombre: "",
  tipo_comida: "ALMUERZO",
  temporada_id: "",
  ingredientes: [{ tempId: crypto.randomUUID(), ingrediente_id: "", cantidad_por_porcion: "" }],
};

function createIngredientRow(): FormIngredient {
  return {
    tempId: crypto.randomUUID(),
    ingrediente_id: "",
    cantidad_por_porcion: "",
  };
}

export default function RecetasPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [recetas, setRecetas] = useState<RecetaRecord[]>([]);
  const [ingredientes, setIngredientes] = useState<IngredienteRecord[]>([]);
  const [temporadas, setTemporadas] = useState<TemporadaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activas");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<RecetaRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [recetasData, ingredientesData, temporadasData] = await Promise.all([
        apiGetRecetas(true),
        apiGetIngredientes(),
        apiGetTemporadas(true),
      ]);
      setRecetas(recetasData);
      setIngredientes(ingredientesData);
      setTemporadas(temporadasData);
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
    setForm({
      nombre: "",
      tipo_comida: "ALMUERZO",
      temporada_id: "",
      ingredientes: [createIngredientRow()],
    });
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
      tipo_comida: receta.tipo_comida,
      temporada_id: receta.temporada_id ? String(receta.temporada_id) : "",
      ingredientes: receta.ingredientes.map((item) => ({
        tempId: crypto.randomUUID(),
        ingrediente_id: String(item.ingrediente_id),
        cantidad_por_porcion: String(item.cantidad_por_porcion),
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

    const cleanedIngredients = form.ingredientes.map((item) => ({
      ingrediente_id: Number(item.ingrediente_id),
      cantidad_por_porcion: Number(item.cantidad_por_porcion),
    }));

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
        tipo_comida: form.tipo_comida,
        temporada_id: temporadaId,
        ingredientes: cleanedIngredients,
      };

      if (modalMode === "create") {
        await apiCreateReceta(payload);
      } else if (editingId !== null) {
        await apiUpdateReceta(editingId, payload);
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cambiar el estado de la receta");
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
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1">
                        {TIPO_COMIDA_LABEL[receta.tipo_comida]}
                      </span>
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
                            .map(
                              (item) =>
                                `${item.ingrediente_nombre} (${item.cantidad_por_porcion} ${item.unidad_medida})`,
                            )
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    Tipo de comida
                  </label>
                  <select
                    value={form.tipo_comida}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tipo_comida: event.target.value as TipoComida,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(TIPO_COMIDA_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
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
                      className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_88px] gap-3 items-end"
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
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Seleccionar ingrediente</option>
                          {ingredientes.map((ingrediente) => (
                            <option key={ingrediente.id} value={ingrediente.id}>
                              {ingrediente.nombre} ({ingrediente.unidad_medida})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Cantidad por porción
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.cantidad_por_porcion}
                          onChange={(event) =>
                            updateIngredientRow(item.tempId, {
                              cantidad_por_porcion: event.target.value,
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
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
