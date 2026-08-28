"use client";

import { useState } from "react";
import {
  apiCreateTipoComida,
  apiGetTiposComida,
  apiToggleTipoComidaActive,
  apiUpdateTipoComida,
  type TipoComidaRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showErrorToast, showSuccessToast } from "@/components/toast";
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

export default function TiposComidaPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const {
    items: tipos,
    loading,
    error,
    create,
    update,
    toggleActive,
  } = useCrud<TipoComidaRecord>({
    list: () => apiGetTiposComida(true),
    create: (data) =>
      apiCreateTipoComida(data as Parameters<typeof apiCreateTipoComida>[0]),
    update: (id, data) =>
      apiUpdateTipoComida(id, data as Parameters<typeof apiUpdateTipoComida>[1]),
    toggleKey: "activo",
    toggle: apiToggleTipoComidaActive,
  });

  const [tab, setTab] = useState<Tab>("activos");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const confirmToggle = useConfirmToggle<TipoComidaRecord>({
    toggle: toggleActive,
    onSuccess: (updated) =>
      showSuccessToast(
        updated?.activo
          ? "Tipo de comida activado correctamente"
          : "Tipo de comida desactivado correctamente",
      ),
    onError: (e) => {
      const message =
        e instanceof Error ? e.message : "Error al cambiar el estado del tipo de comida";
      setPageError(message);
      showErrorToast(message);
    },
  });

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
        await create({ nombre: trimmed });
        showSuccessToast("Tipo de comida creado correctamente");
      } else if (editingId !== null) {
        await update(editingId, { nombre: trimmed });
        showSuccessToast("Tipo de comida actualizado correctamente");
      }
      setModalOpen(false);
      setPageError(null);
    } catch (e: unknown) {
      setFormError(
        e instanceof Error ? e.message : "Error al guardar el tipo de comida",
      );
    } finally {
      setSaving(false);
    }
  }

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

  const visible = tipos.filter((tipo) =>
    tab === "activos" ? tipo.activo : !tipo.activo,
  );
  const tabs = [
    {
      key: "activos",
      label: "Activos",
      count: tipos.filter((tipo) => tipo.activo).length,
    },
    {
      key: "inactivos",
      label: "Inactivos",
      count: tipos.filter((tipo) => !tipo.activo).length,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Tipos de comida"
        description="Desayuno, almuerzo, merienda y los que quieras agregar. Se usan en recetas, menús y escuelas."
      >
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo tipo
        </button>
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
            ? "No hay tipos de comida activos."
            : "No hay tipos de comida inactivos."
        }
        colSpan={3}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Nombre
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Estado
              </th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((tipo) => (
              <tr
                key={tipo.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-gray-800">
                  {tipo.nombre}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      tipo.activo ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  {tipo.activo ? "Activo" : "Inactivo"}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {tipo.activo && (
                      <button
                        onClick={() => openEdit(tipo)}
                        className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => confirmToggle.confirm(tipo)}
                      className={`p-1.5 rounded transition-colors ${
                        tipo.activo
                          ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                          : "text-green-600 hover:text-green-800 hover:bg-green-50"
                      }`}
                      title={tipo.activo ? "Desactivar" : "Activar"}
                    >
                      {tipo.activo ? (
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
              </tr>
            ))}
          </tbody>
        </table>
      </TableState>

      <CrudFormModal
        open={modalOpen}
        title={modalMode === "create" ? "Nuevo tipo de comida" : "Editar tipo de comida"}
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
              placeholder="Ej: Cena"
              autoFocus
            />
          </div>
        </div>
      </CrudFormModal>

      {confirmToggle.target && (
        <ConfirmToggleModal
          title={
            confirmToggle.target.activo
              ? "Desactivar tipo de comida"
              : "Activar tipo de comida"
          }
          message={
            <>
              ¿Querés {confirmToggle.target.activo ? "desactivar" : "activar"} el tipo{" "}
              <span className="font-medium text-gray-800">
                {confirmToggle.target.nombre}
              </span>
              ?
            </>
          }
          confirmLabel={
            confirmToggle.target.activo ? "Desactivar" : "Activar"
          }
          busy={confirmToggle.toggling}
          busyLabel="Procesando..."
          width="max-w-md"
          destructive={confirmToggle.target.activo}
          onCancel={confirmToggle.close}
          onConfirm={confirmToggle.handleConfirm}
        />
      )}
    </div>
  );
}