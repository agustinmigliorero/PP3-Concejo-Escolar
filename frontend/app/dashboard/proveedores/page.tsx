"use client";

import { useEffect, useState } from "react";
import {
  apiCreateProveedor,
  apiGetProveedores,
  apiToggleProveedorActive,
  apiUpdateProveedor,
  type ProveedorRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";

type Tab = "activos" | "inactivos";
type ModalMode = "create" | "edit";

export default function ProveedoresPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [proveedores, setProveedores] = useState<ProveedorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activos");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<ProveedorRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadProveedores() {
    setLoading(true);
    setError(null);
    try {
      setProveedores(await apiGetProveedores());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProveedores();
  }, []);

  function openCreate() {
    setNombre("");
    setContacto("");
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(proveedor: ProveedorRecord) {
    setNombre(proveedor.nombre);
    setContacto(proveedor.contacto);
    setFormError(null);
    setModalMode("edit");
    setEditingId(proveedor.id);
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
        await apiCreateProveedor({ nombre, contacto });
        showSuccessToast("Proveedor creado correctamente");
      } else if (editingId !== null) {
        await apiUpdateProveedor(editingId, { nombre, contacto });
        showSuccessToast("Proveedor actualizado correctamente");
      }
      setModalOpen(false);
      setError(null);
      await loadProveedores();
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
      const updated = await apiToggleProveedorActive(confirmTarget.id);
      setProveedores((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setConfirmTarget(null);
      showSuccessToast(
        updated.activo
          ? "Proveedor activado correctamente"
          : "Proveedor desactivado correctamente",
      );
    } catch {
      setError("Error al cambiar el estado del proveedor");
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  const visible = proveedores.filter((p) =>
    tab === "activos" ? p.activo : !p.activo
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Proveedores</h1>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo proveedor
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["activos", "inactivos"] as Tab[]).map((t) => {
          const count = proveedores.filter((p) =>
            t === "activos" ? p.activo : !p.activo
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">ID</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Contacto</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
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
                  <td className="px-5 py-3 text-gray-400">{p.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{p.nombre}</td>
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
                      <div className="flex items-center justify-end gap-2">
                        {p.activo && (
                          <button
                            onClick={() => openEdit(p)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmTarget(p)}
                          className={`font-medium px-2 py-1 rounded transition-colors ${
                            p.activo
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {p.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    {tab === "activos"
                      ? "No hay proveedores activos."
                      : "No hay proveedores inactivos."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nuevo proveedor" : "Editar proveedor"}
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

      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              {confirmTarget.activo ? "Desactivar proveedor" : "Activar proveedor"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Confirmas que queres{" "}
              <span className="font-medium">
                {confirmTarget.activo ? "desactivar" : "activar"}
              </span>{" "}
              al proveedor{" "}
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
