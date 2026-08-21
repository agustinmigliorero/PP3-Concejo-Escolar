"use client";

import { useEffect, useState } from "react";
import {
  apiGetUsers,
  apiCreateUser,
  apiUpdateUser,
  apiToggleUserActive,
  apiGetSchools,
  type SchoolRecord,
  type UserRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";
import { PasswordInput } from "@/components/password-input";

const ROLES = ["admin", "gestor", "escuela"] as const;
const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  escuela: "Escuela",
};

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

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activos");

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingProtectedAdmin, setEditingProtectedAdmin] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<UserRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const [usersData, schoolsData] = await Promise.all([
        apiGetUsers(),
        apiGetSchools(),
      ]);
      setUsers(usersData);
      setSchools(schoolsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

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
        if (!form.password) { setFormError("La contraseña es obligatoria"); return; }
        await apiCreateUser({
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
        await apiUpdateUser(editingId, payload);
        showSuccessToast("Usuario actualizado correctamente");
      }
      setModalOpen(false);
      await loadUsers();
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
      const updated = await apiToggleUserActive(confirmTarget.id);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setConfirmTarget(null);
      showSuccessToast(
        updated.active
          ? "Usuario activado correctamente"
          : "Usuario desactivado correctamente",
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cambiar el estado del usuario");
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  const visibleUsers = users.filter((u) =>
    tab === "activos" ? u.active : !u.active
  );
  const schoolNameById = new Map(
    schools.map((school) => [
      school.id,
      `${school.code} - ${school.name}`,
    ]),
  );
  const activeSchools = schools.filter((school) => school.active);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo usuario
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
        <button
          onClick={() => setTab("activos")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "activos"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Activos
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
            tab === "activos" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
          }`}>
            {users.filter((u) => u.active).length}
          </span>
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("inactivos")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === "inactivos"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Inactivos
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
              tab === "inactivos" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
            }`}>
              {users.filter((u) => !u.active).length}
            </span>
          </button>
        )}
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
                <th className="text-left px-5 py-3 font-medium text-gray-500">Usuario</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Rol</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Escuela</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                {isAdmin && (
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-400">{u.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{u.username}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : u.role === "gestor"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {u.role === "escuela" && u.school_id
                      ? schoolNameById.get(u.school_id) ?? `Escuela #${u.school_id}`
                      : "No aplica"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${u.active ? "bg-green-500" : "bg-gray-300"}`} />
                    {u.active ? "Activo" : "Inactivo"}
                    {u.is_protected_admin && (
                      <span className="ml-2 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        Protegido
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmTarget(u)}
                          disabled={u.is_protected_admin && u.active}
                          title={
                            u.is_protected_admin && u.active
                              ? "El administrador principal no se puede desactivar"
                              : undefined
                          }
                          className={`font-medium px-2 py-1 rounded transition-colors ${
                            u.is_protected_admin && u.active
                              ? "text-gray-300 cursor-not-allowed"
                              : u.active
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {u.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-5 py-8 text-center text-gray-400">
                    {tab === "activos" ? "No hay usuarios activos." : "No hay usuarios inactivos."}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nuevo usuario" : "Editar usuario"}
            </h2>

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
                  Contraseña {modalMode === "edit" && <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span>}
                </label>
                <PasswordInput
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  disabled={editingProtectedAdmin}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
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
              {confirmTarget.active ? "Desactivar usuario" : "Activar usuario"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Confirmas que queres{" "}
              <span className="font-medium">
                {confirmTarget.active ? "desactivar" : "activar"}
              </span>{" "}
              el usuario{" "}
              <span className="font-semibold text-gray-800">
                {confirmTarget.username}
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
                  confirmTarget.active
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {toggling
                  ? "Guardando..."
                  : confirmTarget.active
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
