"use client";

import { useEffect, useState } from "react";
import {
  apiGetSchools,
  apiCreateSchool,
  apiUpdateSchool,
  apiToggleSchoolActive,
  apiGetLocalidades,
  type SchoolRecord,
  type LocalidadRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";

type Tab = "activas" | "inactivas";
type ModalMode = "create" | "edit";
type MealKey = "offers_breakfast" | "offers_lunch" | "offers_snack" | "offers_dinner";

const MEALS: { key: MealKey; label: string }[] = [
  { key: "offers_breakfast", label: "Desayuno" },
  { key: "offers_lunch", label: "Almuerzo" },
  { key: "offers_snack", label: "Merienda" },
  { key: "offers_dinner", label: "Cena" },
];

interface FormState {
  name: string;
  code: string;
  locality_id: number | null;
  address: string;
  phone: string;
  matriculation: number;
  offers_breakfast: boolean;
  offers_lunch: boolean;
  offers_snack: boolean;
  offers_dinner: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  locality_id: null,
  address: "",
  phone: "",
  matriculation: 0,
  offers_breakfast: false,
  offers_lunch: false,
  offers_snack: false,
  offers_dinner: false,
};

export default function EscuelasPage() {
  const { user: currentUser } = useUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "gestor";

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [localidades, setLocalidades] = useState<LocalidadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activas");

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirm toggle modal
  const [confirmTarget, setConfirmTarget] = useState<SchoolRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const localidadesData = await apiGetLocalidades();
      const schoolsData = await apiGetSchools();
      setSchools(schoolsData);
      setLocalidades(localidadesData.filter((l) => l.activo));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalMode("create");
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(s: SchoolRecord) {
    setForm({
      name: s.name,
      code: s.code,
      locality_id: s.locality_id,
      address: s.address,
      phone: s.phone,
      matriculation: s.matriculation,
      offers_breakfast: s.offers_breakfast,
      offers_lunch: s.offers_lunch,
      offers_snack: s.offers_snack,
      offers_dinner: s.offers_dinner,
    });
    setFormError(null);
    setModalMode("edit");
    setEditingId(s.id);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    if (!form.code.trim()) {
      setFormError("El código es obligatorio");
      return;
    }
    if (!form.locality_id) {
      setFormError("Debe seleccionar una localidad");
      return;
    }
        if (!form.address.trim()) {
      setFormError("La dirección es obligatoria");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("El teléfono es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (modalMode === "create") {
        await apiCreateSchool({
          name: form.name,
          code: form.code,
          locality_id: form.locality_id,
          address: form.address,
          phone: form.phone,
          matriculation: form.matriculation,
          offers_breakfast: form.offers_breakfast,
          offers_lunch: form.offers_lunch,
          offers_snack: form.offers_snack,
          offers_dinner: form.offers_dinner
        });
      } else if (editingId !== null) {
        await apiUpdateSchool(editingId, {
          name: form.name,
          code: form.code,
          locality_id: form.locality_id,
          address: form.address,
          phone: form.phone,
          matriculation: form.matriculation,
          offers_breakfast: form.offers_breakfast,
          offers_lunch: form.offers_lunch,
          offers_snack: form.offers_snack,
          offers_dinner: form.offers_dinner,
        });
      }
      setModalOpen(false);
      setError(null);
      await loadData();
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
      const updated = await apiToggleSchoolActive(confirmTarget.id);
      setSchools((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      setConfirmTarget(null);
    } catch {
      setError("Error al cambiar el estado de la escuela");
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  function mealBadges(s: SchoolRecord) {
    const active: string[] = [];
    if (s.offers_breakfast) active.push("D");
    if (s.offers_lunch) active.push("A");
    if (s.offers_snack) active.push("M");
    if (s.offers_dinner) active.push("C");
    return active.length === 0
      ? <span className="text-gray-400 text-xs">—</span>
      : active.map((m) => (
          <span
            key={m}
            className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded mr-1"
          >
            {m}
          </span>
        ));
  }

  const visible = schools.filter((s) =>
    tab === "activas" ? s.active : !s.active
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Escuelas</h1>
        {canManage && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nueva escuela
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
        {(["activas", "inactivas"] as Tab[]).map((t) => {
          const count = schools.filter((s) =>
            t === "activas" ? s.active : !s.active
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

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">ID</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Código</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Localidad</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Matrícula</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Comidas</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                {canManage && (
                  <th className="text-right px-5 py-3 font-medium text-gray-500">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3 text-gray-400">{s.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono">{s.code}</td>
                  <td className="px-5 py-3 text-gray-600">{s.locality_name}</td>
                  <td className="px-5 py-3 text-gray-800">
                    {s.matriculation.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">{mealBadges(s)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        s.active ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    {s.active ? "Activa" : "Inactiva"}
                  </td>
                  {canManage && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.active && (
                          <button
                            onClick={() => openEdit(s)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmTarget(s)}
                          className={`font-medium px-2 py-1 rounded transition-colors ${
                            s.active
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {s.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 8 : 7}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    {tab === "activas"
                      ? "No hay escuelas activas."
                      : "No hay escuelas inactivas."}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {modalMode === "create" ? "Nueva escuela" : "Editar escuela"}
            </h2>

            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: EP 1"
                    autoFocus
                  />
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="EP1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localidad
                </label>
                <select
                  value={form.locality_id ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      locality_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Seleccionar localidad...</option>
                  {localidades
                    .filter((l) => l.activo)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                </select>
              </div>

<div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Av. San Martín 123"
                  />
                </div>
                <div className="w-44">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 2284-123456"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Matrícula
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.matriculation}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      matriculation: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comidas que ofrece
                </label>
                <div className="flex gap-4">
                  {MEALS.map((meal) => (
                    <label
                      key={meal.key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form[meal.key]}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            [meal.key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{meal.label}</span>
                    </label>
                  ))}
                </div>
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

      {/* Confirm toggle modal */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              {confirmTarget.active ? "Desactivar escuela" : "Activar escuela"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              ¿Confirmás que querés{" "}
              <span className="font-medium">
                {confirmTarget.active ? "desactivar" : "activar"}
              </span>{" "}
              la escuela{" "}
              <span className="font-semibold text-gray-800">
                {confirmTarget.name}
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
