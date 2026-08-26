"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiGetSchools,
  apiToggleSchoolActive,
  apiGetLocalidades,
  apiGetTiposComida,
  type SchoolRecord,
  type LocalidadRecord,
  type TipoComidaRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";
import { SchoolFormModal } from "@/components/school-form-modal";

type Tab = "activas" | "inactivas";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function EscuelasPage() {
  const { user: currentUser } = useUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "gestor";

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [localidades, setLocalidades] = useState<LocalidadRecord[]>([]);
  const [tiposComida, setTiposComida] = useState<TipoComidaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activas");
  const [search, setSearch] = useState("");

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingSchool, setEditingSchool] = useState<SchoolRecord | null>(null);

  // Confirm toggle modal
  const [confirmTarget, setConfirmTarget] = useState<SchoolRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [localidadesData, schoolsData, tiposData] = await Promise.all([
        apiGetLocalidades(),
        apiGetSchools(),
        apiGetTiposComida(),
      ]);
      setSchools(schoolsData);
      setLocalidades(localidadesData.filter((l) => l.activo));
      setTiposComida(tiposData);
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
    setModalMode("create");
    setEditingSchool(null);
    setModalOpen(true);
  }

  function openEdit(s: SchoolRecord) {
    setModalMode("edit");
    setEditingSchool(s);
    setModalOpen(true);
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
      showSuccessToast(
        updated.active
          ? "Escuela activada correctamente"
          : "Escuela desactivada correctamente",
      );
    } catch {
      setError("Error al cambiar el estado de la escuela");
      setConfirmTarget(null);
    } finally {
      setToggling(false);
    }
  }

  function mealBadges(s: SchoolRecord) {
    return s.tipos_comida.length === 0
      ? <span className="text-gray-400 text-xs">—</span>
      : s.tipos_comida.map((tipo) => (
          <span
            key={tipo.id}
            className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded mr-1"
          >
            {tipo.nombre}
          </span>
        ));
  }

  const normalizedSearch = normalizeSearchText(search.trim());
  const visible = schools.filter((s) => {
    const matchesTab = tab === "activas" ? s.active : !s.active;
    if (!matchesTab) return false;
    if (!normalizedSearch) return true;

    return [s.name, s.code, s.locality_name].some((value) =>
      normalizeSearchText(value).includes(normalizedSearch),
    );
  });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Escuelas</h1>
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

      {/* Search */}
      <div className="mb-4">
        <label htmlFor="school-search" className="sr-only">
          Buscar escuela
        </label>
        <input
          id="school-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código o localidad..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">Código</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">Localidad</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Matrículas</th>
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
                  <td data-label="Nombre" className="px-5 py-3 font-medium text-gray-800">
                    <Link
                      href={`/dashboard/escuelas/${s.id}`}
                      className="text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td data-label="Código" className="px-5 py-3 text-gray-600 font-mono hidden md:table-cell">{s.code}</td>
                  <td data-label="Localidad" className="px-5 py-3 text-gray-600 hidden md:table-cell">{s.locality_name}</td>
                  <td data-label="Matrículas" className="px-5 py-3 text-gray-800">
                    <span>{s.matriculation.toLocaleString()} total</span>
                    {s.matriculas_por_tipo?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.matriculas_por_tipo.map((item) => (
                          <span
                            key={item.tipo_comida_id}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                          >
                            {item.tipo_comida_nombre}: {item.cantidad}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td data-label="Comidas" className="px-5 py-3">{mealBadges(s)}</td>
                  <td data-label="Estado" className="px-5 py-3">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        s.active ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    {s.active ? "Activa" : "Inactiva"}
                  </td>
                  {canManage && (
                    <td data-label="Acciones" className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/escuelas/${s.id}`}
                          className="text-slate-600 hover:text-slate-900 font-medium p-1.5 rounded hover:bg-slate-100 transition-colors"
                          title="Ver detalle"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        </Link>
                        {s.active && (
                          <button
                            onClick={() => openEdit(s)}
                            className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmTarget(s)}
                          className={`p-1.5 rounded transition-colors ${
                            s.active
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-800 hover:bg-green-50"
                          }`}
                          title={s.active ? "Desactivar" : "Activar"}
                        >
                          {s.active ? (
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
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    {normalizedSearch
                      ? "No se encontraron escuelas con esa búsqueda."
                      : tab === "activas"
                      ? "No hay escuelas activas."
                      : "No hay escuelas inactivas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Create/edit modal */}
      {modalOpen && (
        <SchoolFormModal
          key={`${modalMode}-${editingSchool?.id ?? "new"}`}
          mode={modalMode}
          school={editingSchool}
          localidades={localidades}
          tiposComida={tiposComida}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            void loadData();
          }}
        />
      )}

      {/* Confirm toggle modal */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6">
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
