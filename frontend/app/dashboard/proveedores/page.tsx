"use client";

import { useState } from "react";
import {
  apiCreateProveedor,
  apiGetProveedores,
  apiToggleProveedorActive,
  apiUpdateProveedor,
  type ProveedorRecord,
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

export default function ProveedoresPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const {
    items: proveedores,
    loading,
    error,
    create,
    update,
    toggleActive,
  } = useCrud<ProveedorRecord>({
    list: apiGetProveedores,
    create: (data) =>
      apiCreateProveedor(data as Parameters<typeof apiCreateProveedor>[0]),
    update: (id, data) =>
      apiUpdateProveedor(id, data as Parameters<typeof apiUpdateProveedor>[1]),
    toggleKey: "activo",
    toggle: apiToggleProveedorActive,
  });

  const [tab, setTab] = useState<Tab>("activos");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const confirmToggle = useConfirmToggle<ProveedorRecord>({
    toggle: toggleActive,
    onSuccess: (updated) =>
      showSuccessToast(
        updated?.activo
          ? "Proveedor activado correctamente"
          : "Proveedor desactivado correctamente",
      ),
    onError: () => setPageError("Error al cambiar el estado del proveedor"),
  });

  function openCreate() {
    setNombre("");
    setContacto("");
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(p: ProveedorRecord) {
    setNombre(p.nombre);
    setContacto(p.contacto);
    setFormError(null);
    setModalMode("edit");
    setEditingId(p.id);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!nombre.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    if (!contacto.trim()) {
      setFormError("El contacto es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (modalMode === "create") {
        await create({ nombre, contacto });
        showSuccessToast("Proveedor creado correctamente");
      } else if (editingId !== null) {
        await update(editingId, { nombre, contacto });
        showSuccessToast("Proveedor actualizado correctamente");
      }
      setModalOpen(false);
      setPageError(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const visible = proveedores.filter((p) =>
    tab === "activos" ? p.activo : !p.activo
  );
  const tabs = [
    {
      key: "activos",
      label: "Activos",
      count: proveedores.filter((p) => p.activo).length,
    },
    {
      key: "inactivos",
      label: "Inactivos",
      count: proveedores.filter((p) => !p.activo).length,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Proveedores">
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo proveedor
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
            ? "No hay proveedores activos."
            : "No hay proveedores inactivos."
        }
        colSpan={isAdmin ? 4 : 3}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">
                ID
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Nombre
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Contacto
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
            {visible.map((p) => (
              <tr
                key={p.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-gray-800">
                  {p.nombre}
                </td>
                <td className="px-5 py-3 text-gray-600">{p.contacto}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      p.activo ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  {p.activo ? "Activo" : "Inactivo"}
                </td>
                {isAdmin && (
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.activo && (
                        <button
                          onClick={() => openEdit(p)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => confirmToggle.confirm(p)}
                        className={`p-1.5 rounded transition-colors ${
                          p.activo
                            ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                            : "text-green-600 hover:text-green-800 hover:bg-green-50"
                        }`}
                        title={p.activo ? "Desactivar" : "Activar"}
                      >
                        {p.activo ? (
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
        title={modalMode === "create" ? "Nuevo proveedor" : "Editar proveedor"}
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
              placeholder="Ej: Proveedor Azul SRL"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contacto
            </label>
            <textarea
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
              placeholder="Telefono, email y direccion"
            />
          </div>
        </div>
      </CrudFormModal>

      {confirmToggle.target && (
        <ConfirmToggleModal
          title={
            confirmToggle.target.activo
              ? "Desactivar proveedor"
              : "Activar proveedor"
          }
          message={
            <>
              Confirmas que queres{" "}
              <span className="font-medium">
                {confirmToggle.target.activo ? "desactivar" : "activar"}
              </span>{" "}
              al proveedor{" "}
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