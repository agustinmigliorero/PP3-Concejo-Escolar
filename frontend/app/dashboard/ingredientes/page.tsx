"use client";

import { useState } from "react";
import {
  apiCreateIngrediente,
  apiGetIngredientes,
  apiToggleIngredienteActive,
  apiUpdateIngrediente,
  type IngredienteRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { TabsWithCounters } from "@/components/tabs-with-counters";
import { TableState } from "@/components/table-state";
import { CrudFormModal } from "@/components/crud-form-modal";
import { ConfirmToggleModal } from "@/components/confirm-toggle-modal";
import { useCrud } from "@/hooks/use-crud";
import { useConfirmToggle } from "@/hooks/use-confirm-toggle";

type Tab = "activos" | "inactivos";
type ModalMode = "create" | "edit";

export default function IngredientesPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const {
    items: ingredientes,
    loading,
    error,
    create,
    update,
    toggleActive,
  } = useCrud<IngredienteRecord>({
    list: () => apiGetIngredientes(true),
    create: (data) =>
      apiCreateIngrediente(data as Parameters<typeof apiCreateIngrediente>[0]),
    update: (id, data) =>
      apiUpdateIngrediente(id, data as Parameters<typeof apiUpdateIngrediente>[1]),
    toggleKey: "activo",
    toggle: apiToggleIngredienteActive,
  });

  const [tab, setTab] = useState<Tab>("activos");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Form fields
  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("");
  const [contenidoPorUnidad, setContenidoPorUnidad] = useState("");
  const [unidadContenido, setUnidadContenido] = useState("");
  const [indiceCorreccion, setIndiceCorreccion] = useState("1.0");

  const confirmToggle = useConfirmToggle<IngredienteRecord>({
    toggle: toggleActive,
    onSuccess: (updated) =>
      showSuccessToast(
        updated?.activo
          ? "Ingrediente activado correctamente"
          : "Ingrediente desactivado correctamente",
      ),
    onError: () => setPageError("Error al cambiar el estado del ingrediente"),
  });

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
        contenido_por_unidad: contenidoPorUnidad
          ? parseFloat(contenidoPorUnidad)
          : null,
        unidad_contenido: unidadContenido || null,
        indice_correccion: parseFloat(indiceCorreccion) || 1.0,
      };

      if (modalMode === "create") {
        await create(data);
        showSuccessToast("Ingrediente creado correctamente");
      } else if (editingId !== null) {
        await update(editingId, data);
        showSuccessToast("Ingrediente actualizado correctamente");
      }
      setModalOpen(false);
      setPageError(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const visible = ingredientes.filter((i) =>
    tab === "activos" ? i.activo : !i.activo,
  );
  const tabs = [
    {
      key: "activos",
      label: "Activos",
      count: ingredientes.filter((i) => i.activo).length,
    },
    {
      key: "inactivos",
      label: "Inactivos",
      count: ingredientes.filter((i) => !i.activo).length,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Ingredientes">
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo ingrediente
          </button>
        )}
      </PageHeader>

      {(error || pageError) && (
        <StatusBanner kind="error">{error || pageError}</StatusBanner>
      )}

      <TabsWithCounters
        tabs={tabs}
        active={tab}
        onChange={(key) => setTab(key as Tab)}
      />

      <TableState
        loading={loading}
        empty={visible.length === 0}
        emptyText={
          tab === "activos"
            ? "No hay ingredientes activos."
            : "No hay ingredientes inactivos."
        }
        colSpan={isAdmin ? 6 : 5}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Nombre
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">
                Unidad
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">
                Contenido/Unidad
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">
                Índice Corr.
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Estado
              </th>
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
                <td className="px-5 py-3 font-medium text-gray-800">
                  {ing.nombre}
                </td>
                <td className="px-5 py-3 text-gray-600">{ing.unidad_medida}</td>
                <td className="px-5 py-3 text-gray-600">
                  {ing.unidad_medida === "unidades" && ing.contenido_por_unidad
                    ? `${ing.contenido_por_unidad} ${ing.unidad_contenido || ""}`
                    : "-"}
                </td>
                <td
                  data-label="Índice corr."
                  className="px-5 py-3 text-gray-600 hidden lg:table-cell"
                >
                  {ing.indice_correccion}
                </td>
                <td data-label="Estado" className="px-5 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      ing.activo ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  {ing.activo ? "Activo" : "Inactivo"}
                </td>
                {isAdmin && (
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {ing.activo && (
                        <button
                          onClick={() => openEdit(ing)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => confirmToggle.confirm(ing)}
                        className={`p-1.5 rounded transition-colors ${
                          ing.activo
                            ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                            : "text-green-600 hover:text-green-800 hover:bg-green-50"
                        }`}
                        title={ing.activo ? "Desactivar" : "Activar"}
                      >
                        {ing.activo ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableState>

      <CrudFormModal
        open={modalOpen}
        title={modalMode === "create" ? "Nuevo ingrediente" : "Editar ingrediente"}
        error={formError}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
        width="max-w-md"
      >
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
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-2">
                  Para ingredientes por unidad, definí cuánto trae cada unidad
                  comercial.
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
      </CrudFormModal>

      {confirmToggle.target && (
        <ConfirmToggleModal
          title={
            confirmToggle.target.activo
              ? "Desactivar ingrediente"
              : "Activar ingrediente"
          }
          message={
            <>
              ¿Confirmás que querés{" "}
              <span className="font-medium">
                {confirmToggle.target.activo ? "desactivar" : "activar"}
              </span>{" "}
              el ingrediente{" "}
              <span className="font-semibold text-gray-800">
                {confirmToggle.target.nombre}
              </span>
              ?
            </>
          }
          confirmLabel={
            confirmToggle.target.activo ? "Desactivar" : "Activar"
          }
          busy={confirmToggle.toggling}
          destructive={confirmToggle.target.activo}
          onCancel={confirmToggle.close}
          onConfirm={confirmToggle.handleConfirm}
        />
      )}
    </div>
  );
}