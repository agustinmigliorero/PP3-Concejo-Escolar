"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiCreateTemporada,
  apiGetTemporadas,
  apiToggleTemporadaActive,
  apiUpdateTemporada,
  type TemporadaRecord,
} from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/components/toast";

type Tab = "activas" | "inactivas";
type ModalMode = "create" | "edit";
type NombreTemporada = "VERANO" | "INVIERNO";

const TEMPORADA_LABEL: Record<NombreTemporada, string> = {
  VERANO: "Verano",
  INVIERNO: "Invierno",
};

interface FormState {
  nombre: NombreTemporada;
  anio: string;
  activo: boolean;
}

const EMPTY_FORM: FormState = {
  nombre: "VERANO",
  anio: String(new Date().getFullYear()),
  activo: false,
};

export default function TemporadasPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

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
  const [confirmTarget, setConfirmTarget] = useState<TemporadaRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  const loadTemporadas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGetTemporadas(true);
      setTemporadas(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar temporadas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadTemporadas();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadTemporadas]);

  const visibleTemporadas = useMemo(
    () => temporadas.filter((temporada) => (tab === "activas" ? temporada.activo : !temporada.activo)),
    [temporadas, tab],
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

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(temporada: TemporadaRecord) {
    setForm({
      nombre: temporada.nombre,
      anio: String(temporada.anio),
      activo: temporada.activo,
    });
    setFormError(null);
    setModalMode("edit");
    setEditingId(temporada.id);
    setModalOpen(true);
  }

  async function handleSaveSeason() {
    const anio = Number(form.anio);

    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      setFormError("Ingresá un año válido entre 2000 y 2100.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (modalMode === "create") {
        await apiCreateTemporada({
          nombre: form.nombre,
          anio,
          activo: form.activo,
        });
        showSuccessToast("Temporada creada correctamente");
      } else if (editingId !== null) {
        await apiUpdateTemporada(editingId, {
          nombre: form.nombre,
          anio,
          activo: form.activo,
        });
        showSuccessToast("Temporada actualizada correctamente");
      } else {
        return;
      }

      setModalOpen(false);
      await loadTemporadas();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar temporada");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmToggleSeason() {
    if (!confirmTarget) return;

    setToggling(true);
    try {
      const updated = await apiToggleTemporadaActive(confirmTarget.id);

      setTemporadas((prev) =>
        prev.map((item) => {
          if (item.id === updated.id) {
            return updated;
          }

          if (updated.activo && item.id !== updated.id) {
            return { ...item, activo: false };
          }

          return item;
        }),
      );
      setConfirmTarget(null);
      setError(null);
      showSuccessToast(
        updated.activo
          ? "Temporada activada correctamente"
          : "Temporada desactivada correctamente",
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Error al cambiar el estado de la temporada";
      setError(message);
      showErrorToast(message);
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Temporadas</h1>
          <p className="text-sm text-gray-500">
            Solo el perfil administrador puede administrar temporadas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Temporadas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Esta pantalla administra temporadas. La asociación de recetas se hace desde recetas.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva temporada
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex gap-1 px-5 pt-4 border-b border-gray-200">
          {(["activas", "inactivas"] as Tab[]).map((currentTab) => {
            const count = temporadas.filter((temporada) =>
              currentTab === "activas" ? temporada.activo : !temporada.activo,
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

        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Temporada</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Año</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleTemporadas.map((temporada) => (
                  <tr
                    key={temporada.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {TEMPORADA_LABEL[temporada.nombre]}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{temporada.anio}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${
                          temporada.activo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            temporada.activo ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {temporada.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(temporada)}
                          className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmTarget(temporada)}
                          className={`font-medium px-2 py-1 rounded transition-colors ${
                            temporada.activo
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {temporada.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleTemporadas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                      {tab === "activas"
                        ? "No hay temporadas activas."
                        : "No hay temporadas inactivas."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nueva temporada" : "Editar temporada"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <select
                  value={form.nombre}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      nombre: event.target.value as NombreTemporada,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="VERANO">Verano</option>
                  <option value="INVIERNO">Invierno</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Año
                </label>
                <input
                  type="number"
                  value={form.anio}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, anio: event.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={2000}
                  max={2100}
                />
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, activo: event.target.checked }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Dejar esta temporada activa
              </label>

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
                  onClick={handleSaveSeason}
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
              {confirmTarget.activo ? "Desactivar temporada" : "Activar temporada"}
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              ¿Querés {confirmTarget.activo ? "desactivar" : "activar"} la temporada{" "}
              <span className="font-semibold text-gray-800">
                {TEMPORADA_LABEL[confirmTarget.nombre]} {confirmTarget.anio}
              </span>
              ?
            </p>
            {!confirmTarget.activo && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 mb-6">
                Al activarla, cualquier otra temporada activa quedará inactiva.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={toggling}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmToggleSeason}
                disabled={toggling}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors text-white disabled:opacity-50 ${
                  confirmTarget.activo
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
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
