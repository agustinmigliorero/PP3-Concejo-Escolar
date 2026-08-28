"use client";

import { useState } from "react";
import {
  apiCreateUser,
  apiGetSchools,
  apiGetUsers,
  apiToggleUserActive,
  apiUpdateUser,
  type SchoolRecord,
  type UserRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";
import { PasswordInput } from "@/components/password-input";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { TabsWithCounters } from "@/components/tabs-with-counters";
import { TableState } from "@/components/table-state";
import { CrudFormModal } from "@/components/crud-form-modal";
import { ConfirmToggleModal } from "@/components/confirm-toggle-modal";
import { ROLE_LABEL } from "@/lib/constants";
import { useCrud } from "@/hooks/use-crud";
import { useAsyncData } from "@/hooks/use-async-data";
import { useConfirmToggle } from "@/hooks/use-confirm-toggle";

const ROLES = ["admin", "gestor", "escuela"] as const;
type ModalMode = "create" | "edit";
type Tab = "activos" | "inactivos";

interface FormState {
  username: string;
  password: string;
  role: string;
  school_id: string;
}

const EMPTY_FORM: FormState = {
  username: "",
  password: "",
  role: "gestor",
  school_id: "",
};

export default function UsuariosPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const {
    items: users,
    loading,
    error,
    create,
    update,
    toggleActive,
  } = useCrud<UserRecord>({
    list: apiGetUsers,
    create: (data) => apiCreateUser(data as Parameters<typeof apiCreateUser>[0]),
    update: (id, data) =>
      apiUpdateUser(id, data as Parameters<typeof apiUpdateUser>[1]),
    toggleKey: "active",
    toggle: apiToggleUserActive,
  });

  const { data: schoolsData } = useAsyncData<SchoolRecord[]>(apiGetSchools);
  const schools = schoolsData ?? [];

  const [tab, setTab] = useState<Tab>("activos");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingProtectedAdmin, setEditingProtectedAdmin] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const confirmToggle = useConfirmToggle<UserRecord>({
    toggle: toggleActive,
    onSuccess: (updated) =>
      showSuccessToast(
        updated?.active
          ? "Usuario activado correctamente"
          : "Usuario desactivado correctamente",
      ),
    onError: (e) =>
      setPageError(
        e instanceof Error ? e.message : "Error al cambiar el estado del usuario",
      ),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setEditingProtectedAdmin(false);
    setModalOpen(true);
  }

  function openEdit(u: UserRecord) {
    setForm({
      username: u.username,
      password: "",
      role: u.role,
      school_id: u.school_id ? String(u.school_id) : "",
    });
    setFormError(null);
    setModalMode("edit");
    setEditingId(u.id);
    setEditingProtectedAdmin(u.is_protected_admin);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    try {
      const schoolId = form.role === "escuela" ? Number(form.school_id) : null;
      if (form.role === "escuela" && !schoolId) {
        setFormError("Selecciona la escuela asociada");
        return;
      }

      if (modalMode === "create") {
        if (!form.password) {
          setFormError("La contraseña es obligatoria");
          return;
        }
        await create({
          username: form.username,
          password: form.password,
          role: form.role,
          school_id: schoolId,
        });
        showSuccessToast("Usuario creado correctamente");
      } else if (editingId !== null) {
        const payload: {
          username: string;
          role: string;
          school_id: number | null;
          password?: string;
        } = {
          username: form.username,
          role: form.role,
          school_id: schoolId,
        };
        if (form.password) payload.password = form.password;
        await update(editingId, payload);
        showSuccessToast("Usuario actualizado correctamente");
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const visibleUsers = users.filter((u) =>
    tab === "activos" ? u.active : !u.active,
  );
  const schoolNameById = new Map(
    schools.map((school) => [school.id, `${school.code} - ${school.name}`]),
  );
  const activeSchools = schools.filter((school) => school.active);
  const tabs = [
    {
      key: "activos",
      label: "Activos",
      count: users.filter((u) => u.active).length,
    },
    ...(isAdmin
      ? [
          {
            key: "inactivos",
            label: "Inactivos",
            count: users.filter((u) => !u.active).length,
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Usuarios">
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo usuario
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
        empty={visibleUsers.length === 0}
        emptyText={
          tab === "activos" ? "No hay usuarios activos." : "No hay usuarios inactivos."
        }
        colSpan={isAdmin ? 5 : 4}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Usuario
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Rol
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">
                Escuela
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
            {visibleUsers.map((u) => (
              <tr
                key={u.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-gray-800">
                  {u.username}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : u.role === "gestor"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td
                  data-label="Escuela"
                  className="px-5 py-3 text-gray-600 hidden lg:table-cell"
                >
                  {u.role === "escuela" && u.school_id
                    ? schoolNameById.get(u.school_id) ?? `Escuela #${u.school_id}`
                    : "No aplica"}
                </td>
                <td data-label="Estado" className="px-5 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${u.active ? "bg-green-500" : "bg-gray-300"}`}
                  />
                  {u.active ? "Activo" : "Inactivo"}
                  {u.is_protected_admin && (
                    <span className="ml-2 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      Protegido
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => confirmToggle.confirm(u)}
                        disabled={u.is_protected_admin && u.active}
                        title={
                          u.is_protected_admin && u.active
                            ? "El administrador principal no se puede desactivar"
                            : u.active
                              ? "Desactivar"
                              : "Activar"
                        }
                        className={`p-1.5 rounded transition-colors ${
                          u.is_protected_admin && u.active
                            ? "text-gray-300 cursor-not-allowed"
                            : u.active
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                        }`}
                      >
                        {u.active ? (
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
        title={modalMode === "create" ? "Nuevo usuario" : "Editar usuario"}
        error={formError}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="nombre_usuario"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña{" "}
              {modalMode === "edit" && (
                <span className="text-gray-400 font-normal">
                  (dejar vacío para no cambiar)
                </span>
              )}
            </label>
            <PasswordInput
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              disabled={editingProtectedAdmin}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {editingProtectedAdmin && (
              <p className="text-xs text-gray-500 mt-1">
                El administrador principal debe conservar el rol administrador.
              </p>
            )}
          </div>

          {form.role === "escuela" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Escuela asociada
              </label>
              <select
                value={form.school_id}
                onChange={(e) => setForm((f) => ({ ...f, school_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleccionar escuela...</option>
                {activeSchools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.code} - {school.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CrudFormModal>

      {confirmToggle.target && (
        <ConfirmToggleModal
          title={
            confirmToggle.target.active
              ? "Desactivar usuario"
              : "Activar usuario"
          }
          message={
            <>
              Confirmas que queres{" "}
              <span className="font-medium">
                {confirmToggle.target.active ? "desactivar" : "activar"}
              </span>{" "}
              el usuario{" "}
              <span className="font-semibold text-gray-800">
                {confirmToggle.target.username}
              </span>
              ?
            </>
          }
          confirmLabel={
            confirmToggle.target.active ? "Desactivar" : "Activar"
          }
          busy={confirmToggle.toggling}
          destructive={confirmToggle.target.active}
          onCancel={confirmToggle.close}
          onConfirm={confirmToggle.handleConfirm}
        />
      )}
    </div>
  );
}
