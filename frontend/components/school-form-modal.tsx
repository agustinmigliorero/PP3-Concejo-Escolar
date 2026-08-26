"use client";

import { useState } from "react";
import {
  apiCreateSchool,
  apiUpdateSchool,
  type LocalidadRecord,
  type SchoolRecord,
  type TipoComidaRecord,
} from "@/lib/api";
import { showSuccessToast } from "@/components/toast";

type ModalMode = "create" | "edit";

interface FormState {
  name: string;
  code: string;
  locality_id: number | null;
  address: string;
  phone: string;
  email: string;
  matriculation: number;
  matriculas_por_tipo: Record<number, number>;
  tipos_comida_ids: number[];
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  locality_id: null,
  address: "",
  phone: "",
  email: "",
  matriculation: 0,
  matriculas_por_tipo: {},
  tipos_comida_ids: [],
};

function formFromSchool(school: SchoolRecord): FormState {
  const savedMatriculas = new Map(
    (school.matriculas_por_tipo ?? []).map((item) => [item.tipo_comida_id, item.cantidad]),
  );

  return {
    name: school.name,
    code: school.code,
    locality_id: school.locality_id,
    address: school.address,
    phone: school.phone ?? "",
    email: school.email ?? "",
    matriculation: school.matriculation,
    matriculas_por_tipo: Object.fromEntries(
      school.tipos_comida.map((tipo) => [
        tipo.id,
        savedMatriculas.get(tipo.id) ?? school.matriculation,
      ]),
    ),
    tipos_comida_ids: school.tipos_comida.map((tipo) => tipo.id),
  };
}

interface SchoolFormModalProps {
  mode: ModalMode;
  school?: SchoolRecord | null;
  localidades: LocalidadRecord[];
  tiposComida: TipoComidaRecord[];
  onClose: () => void;
  onSaved?: (school: SchoolRecord) => void;
}

export function SchoolFormModal({
  mode,
  school,
  localidades,
  tiposComida,
  onClose,
  onSaved,
}: SchoolFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    mode === "edit" && school ? formFromSchool(school) : EMPTY_FORM,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    const matriculasPorTipo = form.tipos_comida_ids.map((tipoComidaId) => ({
      tipo_comida_id: tipoComidaId,
      cantidad: form.matriculas_por_tipo[tipoComidaId] ?? form.matriculation,
    }));
    if (
      matriculasPorTipo.some(
        (item) => !Number.isInteger(item.cantidad) || item.cantidad < 0,
      )
    ) {
      setFormError(
        "Las matrículas por servicio deben ser números enteros mayores o iguales a 0",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        locality_id: form.locality_id,
        address: form.address,
        matriculation: form.matriculation,
        matriculas_por_tipo: matriculasPorTipo,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        tipos_comida_ids: form.tipos_comida_ids,
      };

      const saved =
        mode === "create"
          ? await apiCreateSchool(payload)
          : school
            ? await apiUpdateSchool(school.id, payload)
            : null;

      if (!saved) {
        setFormError("No se encontró la escuela a editar");
        return;
      }

      onSaved?.(saved);
      showSuccessToast(
        mode === "create"
          ? "Escuela creada correctamente"
          : "Escuela actualizada correctamente",
      );
      onClose();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <h2 className="mb-5 text-lg font-bold text-gray-800">
          {mode === "create" ? "Nueva escuela" : "Editar escuela"}
        </h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: EP 1"
                autoFocus
              />
            </div>
            <div className="sm:w-28">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Código
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="EP1"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Localidad
            </label>
            <select
              value={form.locality_id ?? ""}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  locality_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar localidad...</option>
              {localidades
                .filter((localidad) => localidad.activo)
                .map((localidad) => (
                  <option key={localidad.id} value={localidad.id}>
                    {localidad.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Dirección
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Av. San Martín 123"
              />
            </div>
            <div className="min-w-0 sm:w-44">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Teléfono <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: 2281-123456"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: escuela@dominio.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Matrícula general
            </label>
            <p className="mb-1 text-xs text-gray-500">
              Se conserva como referencia. El pedido usa la cantidad de cada servicio.
            </p>
            <input
              type="number"
              min={0}
              value={form.matriculation}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  matriculation: Math.max(0, Number(e.target.value)),
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Cupos por servicio
            </label>
            <p className="mb-3 text-xs text-gray-500">
              Indicá cuántos alumnos reciben cada servicio para calcular el pedido.
            </p>
            {tiposComida.length === 0 ? (
              <p className="text-xs text-gray-400">
                No hay tipos de comida activos. Creá uno en la sección &quot;Tipos de comida&quot;.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {tiposComida.map((tipo) => {
                  const checked = form.tipos_comida_ids.includes(tipo.id);
                  return (
                    <div
                      key={tipo.id}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <label className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm((current) => {
                              if (e.target.checked) {
                                return {
                                  ...current,
                                  tipos_comida_ids: [...current.tipos_comida_ids, tipo.id],
                                  matriculas_por_tipo: {
                                    ...current.matriculas_por_tipo,
                                    [tipo.id]:
                                      current.matriculas_por_tipo[tipo.id] ?? current.matriculation,
                                  },
                                };
                              }
                              return {
                                ...current,
                                tipos_comida_ids: current.tipos_comida_ids.filter(
                                  (id) => id !== tipo.id,
                                ),
                                matriculas_por_tipo: Object.fromEntries(
                                  Object.entries(current.matriculas_por_tipo).filter(
                                    ([id]) => Number(id) !== tipo.id,
                                  ),
                                ),
                              };
                            })
                          }
                          className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 text-sm text-gray-700">{tipo.nombre}</span>
                      </label>
                      {checked && (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          aria-label={`Cupos de ${tipo.nombre}`}
                          value={form.matriculas_por_tipo[tipo.id] ?? 0}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              matriculas_por_tipo: {
                                ...current.matriculas_por_tipo,
                                [tipo.id]: Math.max(0, Number(e.target.value)),
                              },
                            }))
                          }
                          className="w-24 shrink-0 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {formError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {formError}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
