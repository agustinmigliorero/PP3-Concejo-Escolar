"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiCreateTemporada,
  apiGetTemporadas,
  apiToggleTemporadaActive,
  apiUpdateTemporada,
  apiUpdateTemporadaOpciones,
  type TemporadaRecord,
} from "@/lib/api";

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
  const [selectedTemporadaId, setSelectedTemporadaId] = useState<number | null>(null);
  const selectedTemporadaIdRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activas");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [menuForm, setMenuForm] = useState<Record<1 | 2, string>>({ 1: "", 2: "" });
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuSaving, setMenuSaving] = useState(false);

  useEffect(() => {
    selectedTemporadaIdRef.current = selectedTemporadaId;
  }, [selectedTemporadaId]);

  const loadTemporadas = useCallback(async (nextSelectedId?: number | null) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGetTemporadas(true);
      setTemporadas(data);

      const fallbackSelected =
        nextSelectedId ??
        selectedTemporadaIdRef.current ??
        data.find((temporada) => temporada.activo)?.id ??
        data[0]?.id ??
        null;

      setSelectedTemporadaId(fallbackSelected);
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

  const selectedTemporada =
    temporadas.find((temporada) => temporada.id === selectedTemporadaId) ?? null;

  useEffect(() => {
    if (!selectedTemporada) {
      setMenuForm({ 1: "", 2: "" });
      return;
    }

    const option1 = selectedTemporada.opciones_menu.find((opcion) => opcion.numero_opcion === 1);
    const option2 = selectedTemporada.opciones_menu.find((opcion) => opcion.numero_opcion === 2);

    setMenuForm({
      1: option1?.descripcion ?? "",
      2: option2?.descripcion ?? "",
    });
    setMenuError(null);
  }, [selectedTemporada]);

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
      let saved: TemporadaRecord;

      if (modalMode === "create") {
        saved = await apiCreateTemporada({
          nombre: form.nombre,
          anio,
          activo: form.activo,
        });
      } else if (editingId !== null) {
        saved = await apiUpdateTemporada(editingId, {
          nombre: form.nombre,
          anio,
          activo: form.activo,
        });
      } else {
        return;
      }

      setModalOpen(false);
      await loadTemporadas(saved.id);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar temporada");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSeason(temporada: TemporadaRecord) {
    try {
      const updated = await apiToggleTemporadaActive(temporada.id);

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

      setSelectedTemporadaId(updated.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cambiar el estado de la temporada");
    }
  }

  async function handleSaveMenus() {
    if (!selectedTemporada) return;

    setMenuSaving(true);
    setMenuError(null);

    try {
      const updated = await apiUpdateTemporadaOpciones(selectedTemporada.id, [
        { numero_opcion: 1, descripcion: menuForm[1].trim() || null },
        { numero_opcion: 2, descripcion: menuForm[2].trim() || null },
      ]);

      setTemporadas((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedTemporadaId(updated.id);
    } catch (e: unknown) {
      setMenuError(e instanceof Error ? e.message : "Error al guardar los menús");
    } finally {
      setMenuSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Temporadas</h1>
          <p className="text-sm text-gray-500">
            Solo el perfil administrador puede seleccionar temporadas y definir sus menús.
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
            El administrador selecciona una temporada y define solo los menús de esa temporada.
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)] gap-6">
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
                  {visibleTemporadas.map((temporada) => {
                    const isSelected = temporada.id === selectedTemporadaId;

                    return (
                      <tr
                        key={temporada.id}
                        className={`border-b border-gray-50 transition-colors ${
                          isSelected ? "bg-blue-50/70" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-gray-800">
                          <button
                            type="button"
                            onClick={() => setSelectedTemporadaId(temporada.id)}
                            className="text-left hover:text-blue-700 transition-colors"
                          >
                            {TEMPORADA_LABEL[temporada.nombre]}
                          </button>
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
                              onClick={() => setSelectedTemporadaId(temporada.id)}
                              className="text-gray-600 hover:text-gray-800 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                            >
                              Menús
                            </button>
                            <button
                              onClick={() => openEdit(temporada)}
                              className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleSeason(temporada)}
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
                    );
                  })}

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

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {!selectedTemporada ? (
            <div className="h-full flex items-center justify-center text-center text-gray-400">
              Seleccioná una temporada para editar sus menús.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wide font-medium text-blue-600 mb-2">
                  Temporada seleccionada
                </p>
                <h2 className="text-xl font-bold text-gray-800">
                  {TEMPORADA_LABEL[selectedTemporada.nombre]} {selectedTemporada.anio}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Solo se editan los menús correspondientes a esta temporada.
                </p>
              </div>

              {menuError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {menuError}
                </p>
              )}

              {[1, 2].map((numero) => (
                <div key={numero} className="border border-gray-200 rounded-xl p-4 bg-gray-50/70">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Menú opción {numero}
                  </label>
                  <textarea
                    value={menuForm[numero as 1 | 2]}
                    onChange={(event) =>
                      setMenuForm((prev) => ({
                        ...prev,
                        [numero]: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                    placeholder={
                      numero === 1
                        ? "Ej: Semana A - Invierno 2026"
                        : "Ej: Semana B - Invierno 2026"
                    }
                  />
                </div>
              ))}

              <button
                onClick={handleSaveMenus}
                disabled={menuSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {menuSaving ? "Guardando menús..." : "Guardar menús de la temporada"}
              </button>
            </div>
          )}
        </section>
      </div>

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
    </div>
  );
}
