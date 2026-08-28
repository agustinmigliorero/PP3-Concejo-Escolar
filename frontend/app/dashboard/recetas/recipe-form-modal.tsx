"use client";

import { useMemo } from "react";
import {
  type IngredienteRecord,
  type TemporadaRecord,
  type TipoComidaRecord,
} from "@/lib/api";
import { getRecipeUnitConfig } from "@/lib/units";

export type ModalMode = "create" | "edit";

export interface FormIngredient {
  tempId: string;
  ingrediente_id: string;
  cantidad_por_porcion: string;
}

export interface FormState {
  nombre: string;
  tipos_comida_ids: number[];
  temporada_id: string;
  ingredientes: FormIngredient[];
}

/**
 * Create/edit modal for recetas (RecipeForm with dynamic ingredient rows).
 * Form state stays in the page (AD-1); this component only renders the
 * controlled shell + fields, verbatim from the original page markup.
 * Kept native (NOT InlineModal/CrudFormModal): original uses
 * `max-h-[90vh] overflow-y-auto` (InlineModal has no max-height) and a
 * bespoke footer (`justify-end pt-2` + text buttons) that differs from
 * CrudFormModal's flex-1 bordered footer.
 */
export function RecipeFormModal({
  open,
  mode,
  form,
  saving,
  formError,
  ingredientes,
  temporadas,
  tiposComida,
  setForm,
  onUpdateIngredientRow,
  onAddIngredientRow,
  onRemoveIngredientRow,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: ModalMode;
  form: FormState;
  saving: boolean;
  formError: string | null;
  ingredientes: IngredienteRecord[];
  temporadas: TemporadaRecord[];
  tiposComida: TipoComidaRecord[];
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onUpdateIngredientRow: (tempId: string, patch: Partial<FormIngredient>) => void;
  onAddIngredientRow: () => void;
  onRemoveIngredientRow: (tempId: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const ingredientesById = useMemo(
    () => new Map(ingredientes.map((ingrediente) => [ingrediente.id, ingrediente])),
    [ingredientes],
  );

  function recipeUnitFor(ingredienteId: string): string | null {
    const ingrediente = ingredientesById.get(Number(ingredienteId));
    return ingrediente ? getRecipeUnitConfig(ingrediente).recipeUnit : null;
  }

  function orderUnitFor(ingredienteId: string): string | null {
    const ingrediente = ingredientesById.get(Number(ingredienteId));
    return ingrediente ? getRecipeUnitConfig(ingrediente).orderUnit : null;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-800 mb-5">
          {mode === "create" ? "Nueva receta" : "Editar receta"}
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
                onClick={onAddIngredientRow}
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
                        onUpdateIngredientRow(item.tempId, {
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
                          onUpdateIngredientRow(item.tempId, {
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
                    onClick={() => onRemoveIngredientRow(item.tempId)}
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

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <button
              onClick={() => onClose()}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}