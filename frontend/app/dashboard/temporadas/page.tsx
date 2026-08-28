"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiCreateTemporada,
  apiGetTemporadas,
  apiToggleTemporadaActive,
  apiUpdateTemporada,
  type TemporadaRecord,
} from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/components/toast";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { TabsWithCounters } from "@/components/tabs-with-counters";
import { TableState } from "@/components/table-state";
import { CrudFormModal } from "@/components/crud-form-modal";
import { ConfirmToggleModal } from "@/components/confirm-toggle-modal";
import { useConfirmToggle } from "@/hooks/use-confirm-toggle";

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

  const confirmToggle = useConfirmToggle<TemporadaRecord>({
    toggle: (id) => apiToggleTemporadaActive(id),
    onSuccess: (updated) => {
      if (!updated) return;

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
      setError(null);
      showSuccessToast(
        updated.activo
          ? "Temporada activada correctamente"
          : "Temporada desactivada correctamente",
      );
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error ? e.message : "Error al cambiar el estado de la temporada";
      setError(message);
      showErrorToast(message);
    },
  });

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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Temporadas</h1>
          <p className="text-sm text-gray-500">
            Solo el perfil administrador puede administrar temporadas.
          </p>
        </div>
      </div>
    );
  }

  async function handleSave() {
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

  const visible = temporadas.filter((t) =>
    tab === "activas" ? t.activo : !t.activo,
  );
  const tabs = [
    {
      key: "activas",
      label: "Activas",
      count: temporadas.filter((t) => t.activo).length,
    },
    {
      key: "inactivas",
      label: "Inactivas",
      count: temporadas.filter((t) => !t.activo).length,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Temporadas"
        description="Esta pantalla administra temporadas. La asociación de recetas se hace desde recetas."
      >
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva temporada
        </button>
      </PageHeader>

      {error && <StatusBanner kind="error">{error}</StatusBanner>}

      <TabsWithCounters
        tabs={tabs}
        active={tab}
        onChange={(key) => setTab(key as Tab)}
      />

      <TableState
        loading={loading}
        empty={visible.length === 0}
        emptyText={
          tab === "activas"
            ? "No hay temporadas activas."
            : "No hay temporadas inactivas."
        }
        colSpan={4}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Temporada
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Año
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
            {visible.map((temporada) => (
              <tr
                key={temporada.id}
                className="border-b border-gray-50 transition-colors hover:bg-gray-50"
              >
                <td
                  data-label="Temporada"
                  className="px-5 py-3 font-medium text-gray-800"
                >
                  {TEMPORADA_LABEL[temporada.nombre]}
                </td>
                <td data-label="Año" className="px-5 py-3 text-gray-600">
                  {temporada.anio}
                </td>
                <td data-label="Estado" className="px-5 py-3">
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
                <td data-label="Acciones" className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(temporada)}
                      className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => confirmToggle.confirm(temporada)}
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
          </tbody>
        </table>
      </TableState>

      <CrudFormModal
        open={modalOpen}
        title={modalMode === "create" ? "Nueva temporada" : "Editar temporada"}
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
        </div>
      </CrudFormModal>

      {confirmToggle.target && (
        <ConfirmToggleModal
          title={
            confirmToggle.target.activo
              ? "Desactivar temporada"
              : "Activar temporada"
          }
          message={
            <>
              ¿Querés {confirmToggle.target.activo ? "desactivar" : "activar"} la
              temporada{" "}
              <span className="font-semibold text-gray-800">
                {TEMPORADA_LABEL[confirmToggle.target.nombre]}{" "}
                {confirmToggle.target.anio}
              </span>
              ?
              {!confirmToggle.target.activo && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Al activarla, cualquier otra temporada activa quedará inactiva.
                </div>
              )}
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
