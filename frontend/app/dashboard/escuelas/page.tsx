"use client";

import Link from "next/link";
import { useState } from "react";
import {
  apiGetLocalidades,
  apiGetSchools,
  apiGetTiposComida,
  apiToggleSchoolActive,
  type LocalidadRecord,
  type SchoolRecord,
  type TipoComidaRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";
import { SchoolFormModal } from "@/components/school-form-modal";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { TabsWithCounters } from "@/components/tabs-with-counters";
import { TableState } from "@/components/table-state";
import { ConfirmToggleModal } from "@/components/confirm-toggle-modal";
import { useCrud } from "@/hooks/use-crud";
import { useAsyncData } from "@/hooks/use-async-data";
import { useConfirmToggle } from "@/hooks/use-confirm-toggle";

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

  const {
    items: schools,
    loading,
    error: dataError,
    reload,
    toggleActive,
  } = useCrud<SchoolRecord>({
    list: () => apiGetSchools(),
    toggleKey: "active",
    toggle: apiToggleSchoolActive,
  });

  // Auxiliary data for the SchoolFormModal (localidades + tipos de comida).
  // Loaded together so the create/edit dialog has both dropdowns available.
  const aux = useAsyncData<{
    localidades: LocalidadRecord[];
    tiposComida: TipoComidaRecord[];
  }>(async () => {
    const [localidadesData, tiposData] = await Promise.all([
      apiGetLocalidades(),
      apiGetTiposComida(),
    ]);
    return {
      localidades: localidadesData.filter((l) => l.activo),
      tiposComida: tiposData,
    };
  });

  const [tab, setTab] = useState<Tab>("activas");
  const [search, setSearch] = useState("");

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingSchool, setEditingSchool] = useState<SchoolRecord | null>(null);

  const [toggleError, setToggleError] = useState<string | null>(null);

  const confirmToggle = useConfirmToggle<SchoolRecord>({
    toggle: toggleActive,
    onSuccess: (updated) =>
      showSuccessToast(
        updated?.active
          ? "Escuela activada correctamente"
          : "Escuela desactivada correctamente",
      ),
    onError: () => setToggleError("Error al cambiar el estado de la escuela"),
  });

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

  const pageError = dataError || aux.error || toggleError;

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

  const tabs = [
    {
      key: "activas",
      label: "Activas",
      count: schools.filter((s) => s.active).length,
    },
    {
      key: "inactivas",
      label: "Inactivas",
      count: schools.filter((s) => !s.active).length,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Escuelas">
        {canManage && (
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nueva escuela
          </button>
        )}
      </PageHeader>

      {pageError && <StatusBanner kind="error">{pageError}</StatusBanner>}

      <TabsWithCounters
        tabs={tabs}
        active={tab}
        onChange={(key) => setTab(key as Tab)}
      />

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

      <TableState
        loading={loading}
        empty={visible.length === 0}
        emptyText={
          normalizedSearch
            ? "No se encontraron escuelas con esa búsqueda."
            : tab === "activas"
            ? "No hay escuelas activas."
            : "No hay escuelas inactivas."
        }
        colSpan={canManage ? 7 : 6}
      >
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
                <td className="px-5 py-3 font-medium text-gray-800">
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
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
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
                        onClick={() => confirmToggle.confirm(s)}
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
          </tbody>
        </table>
      </TableState>

      {/* Create/edit modal */}
      {modalOpen && (
        <SchoolFormModal
          key={`${modalMode}-${editingSchool?.id ?? "new"}`}
          mode={modalMode}
          school={editingSchool}
          localidades={aux.data?.localidades ?? []}
          tiposComida={aux.data?.tiposComida ?? []}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            void reload();
            void aux.reload();
          }}
        />
      )}

      {/* Confirm toggle modal */}
      {confirmToggle.target && (
        <ConfirmToggleModal
          title={
            confirmToggle.target.active
              ? "Desactivar escuela"
              : "Activar escuela"
          }
          message={
            <>
              ¿Confirmás que querés{" "}
              <span className="font-medium">
                {confirmToggle.target.active ? "desactivar" : "activar"}
              </span>{" "}
              la escuela{" "}
              <span className="font-semibold text-gray-800">
                {confirmToggle.target.name}
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
