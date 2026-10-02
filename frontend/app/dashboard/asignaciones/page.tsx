"use client";

import { useEffect, useState } from "react";
import {
  apiCreateAsignacionesLote,
  apiGetAsignaciones,
  apiGetAsignacionHistorial,
  apiGetAsignacionPrecioHistorial,
  apiGetIngredientes,
  apiGetLocalidades,
  apiGetProveedores,
  apiUpdateAsignacionPrecio,
  type AsignacionPrecioHistorialRecord,
  type AsignacionRecord,
  type IngredienteRecord,
  type LocalidadRecord,
  type ProveedorRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";
import { showSuccessToast } from "@/components/toast";
import { StatusBanner } from "@/components/status-banner";
import { PageHeader } from "@/components/page-header";
import { TableState } from "@/components/table-state";
import { CrudFormModal } from "@/components/crud-form-modal";
import { formatDate, formatMoney } from "@/lib/format";

// Fecha local solo-fecha (DD/MM/YYYY, "—" si falta). NO es formatDate de
// lib/format (esa es fecha+hora es-AR con "Sin carga"); se conserva local para
// mantener la salida byte-idéntica.
function fmtFecha(v: string | null): string {
  if (!v) return "—";
  // v viene como YYYY-MM-DD; evitamos desfasajes de timezone.
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

export default function AsignacionesPage() {
  const { user: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const [asignaciones, setAsignaciones] = useState<AsignacionRecord[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorRecord[]>([]);
  const [ingredientes, setIngredientes] = useState<IngredienteRecord[]>([]);
  const [localidades, setLocalidades] = useState<LocalidadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterIngrediente, setFilterIngrediente] = useState<string>("");
  const [filterLocalidad, setFilterLocalidad] = useState<string>("");
  const [filterProveedor, setFilterProveedor] = useState<string>("");

  // Modal crear
  const [createOpen, setCreateOpen] = useState(false);
  const [cProveedor, setCProveedor] = useState<string>("");
  const [cIngrediente, setCIngrediente] = useState<string>("");
  const [cLocalidades, setCLocalidades] = useState<number[]>([]);
  const [cPrecios, setCPrecios] = useState<Record<number, string>>({});
  const [cFecha, setCFecha] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal editar precio
  const [editTarget, setEditTarget] = useState<AsignacionRecord | null>(null);
  const [editPrecio, setEditPrecio] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Modal historial
  const [histTarget, setHistTarget] = useState<AsignacionRecord | null>(null);
  const [historial, setHistorial] = useState<AsignacionRecord[]>([]);
  const [precioHistorial, setPrecioHistorial] = useState<
    AsignacionPrecioHistorialRecord[]
  >([]);
  const [histLoading, setHistLoading] = useState(false);

  async function loadAsignaciones() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetAsignaciones({
        ingrediente_id: filterIngrediente
          ? Number(filterIngrediente)
          : undefined,
        localidad_id: filterLocalidad ? Number(filterLocalidad) : undefined,
        proveedor_id: filterProveedor ? Number(filterProveedor) : undefined,
        solo_vigentes: true,
      });
      setAsignaciones(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar asignaciones");
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial de catálogos
  useEffect(() => {
    (async () => {
      try {
        const [provs, ings, locs] = await Promise.all([
          apiGetProveedores(),
          apiGetIngredientes(),
          apiGetLocalidades(),
        ]);
        setProveedores(provs);
        setIngredientes(ings);
        setLocalidades(locs);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar catálogos");
      }
    })();
  }, []);

  // Recarga al cambiar filtros
  useEffect(() => {
    loadAsignaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterIngrediente, filterLocalidad, filterProveedor]);

  function openCreate() {
    setCProveedor(proveedores.some((p) => p.activo && String(p.id) === filterProveedor) ? filterProveedor : "");
    setCIngrediente(ingredientes.some((i) => i.activo && String(i.id) === filterIngrediente) ? filterIngrediente : "");
    setCLocalidades(localidades.some((l) => l.activo && String(l.id) === filterLocalidad) ? [Number(filterLocalidad)] : []);
    setCPrecios({});
    setCFecha("");
    setFormError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (saving) return;
    setFormError(null);
    if (!cProveedor || !cIngrediente) {
      setFormError("Seleccioná un ingrediente y un proveedor");
      return;
    }
    if (cLocalidades.length === 0) {
      setFormError("Seleccioná al menos una localidad");
      return;
    }
    const invalidLocalidad = cLocalidades.find((id) => {
      const precio = Number(cPrecios[id]);
      return !cPrecios[id]?.trim() || !Number.isFinite(precio) || precio < 0.01
        || precio > 9999999999.99
        || Math.abs(precio * 100 - Math.round(precio * 100)) > 0.000001;
    });
    if (invalidLocalidad !== undefined) {
      const nombre = localidades.find((l) => l.id === invalidLocalidad)?.nombre;
      setFormError(`Ingresá un precio válido mayor a 0, con hasta 2 decimales, para ${nombre}`);
      document.getElementById(`precio-localidad-${invalidLocalidad}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await apiCreateAsignacionesLote({
        proveedor_id: Number(cProveedor),
        ingrediente_id: Number(cIngrediente),
        localidades: cLocalidades.map((id) => ({
          localidad_id: id,
          precio_unitario: Number(cPrecios[id]),
        })),
        fecha_desde: cFecha || null,
      });
      setCreateOpen(false);
      await loadAsignaciones();
      showSuccessToast(cLocalidades.length === 1
        ? "Asignación creada correctamente"
        : `${cLocalidades.length} asignaciones creadas correctamente`);
    } catch (e: unknown) {
      setFormError(
        e instanceof Error ? e.message : "Error al crear las asignaciones",
      );
    } finally {
      setSaving(false);
    }
  }

  function openEdit(a: AsignacionRecord) {
    setEditTarget(a);
    setEditPrecio(String(Number(a.precio_unitario)));
    setEditError(null);
  }

  async function handleEdit() {
    if (!editTarget) return;
    setEditError(null);
    const precio = Number(editPrecio);
    if (!editPrecio || Number.isNaN(precio) || precio <= 0) {
      setEditError("El precio debe ser un número mayor a 0");
      return;
    }
    setEditSaving(true);
    try {
      await apiUpdateAsignacionPrecio(editTarget.id, precio);
      setEditTarget(null);
      await loadAsignaciones();
      showSuccessToast("Precio actualizado correctamente");
    } catch (e: unknown) {
      setEditError(
        e instanceof Error ? e.message : "Error al actualizar el precio",
      );
    } finally {
      setEditSaving(false);
    }
  }

  async function openHistorial(a: AsignacionRecord) {
    setHistTarget(a);
    setHistorial([]);
    setPrecioHistorial([]);
    setHistLoading(true);
    // Ambas tablas son del mismo (ingrediente, localidad): los tramos de
    // proveedor y las correcciones de precio aplicadas sobre ellos.
    const [tramos, cambios] = await Promise.allSettled([
      apiGetAsignacionHistorial(a.ingrediente_id, a.localidad_id),
      apiGetAsignacionPrecioHistorial(a.ingrediente_id, a.localidad_id),
    ]);
    setHistorial(tramos.status === "fulfilled" ? tramos.value : []);
    setPrecioHistorial(
      cambios.status === "fulfilled" ? cambios.value : [],
    );
    setHistLoading(false);
  }

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No tenés permisos para ver esta sección.
        </p>
      </div>
    );
  }

  const selectCls =
    "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const localidadesActivas = localidades.filter((l) => l.activo);
  const allSelected = localidadesActivas.length > 0 && cLocalidades.length === localidadesActivas.length;
  const unidadPrecio = ingredientes.find((i) => String(i.id) === cIngrediente)?.unidad_medida;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Asignaciones de proveedores">
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva asignación
        </button>
      </PageHeader>

      <p className="text-sm text-gray-500 mb-4">
        Quién provee cada ingrediente en cada localidad y a qué precio. Solo se
        muestran las asignaciones vigentes; crear una nueva cierra
        automáticamente la anterior de esa combinación.
      </p>

      {error && <StatusBanner kind="error">{error}</StatusBanner>}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterIngrediente}
          onChange={(e) => setFilterIngrediente(e.target.value)}
          className={selectCls}
        >
          <option value="">Todos los ingredientes</option>
          {ingredientes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
        <select
          value={filterLocalidad}
          onChange={(e) => setFilterLocalidad(e.target.value)}
          className={selectCls}
        >
          <option value="">Todas las localidades</option>
          {localidades.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
        <select
          value={filterProveedor}
          onChange={(e) => setFilterProveedor(e.target.value)}
          className={selectCls}
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        {(filterIngrediente || filterLocalidad || filterProveedor) && (
          <button
            onClick={() => {
              setFilterIngrediente("");
              setFilterLocalidad("");
              setFilterProveedor("");
            }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <TableState loading={loading}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Ingrediente
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Localidad
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">
                Proveedor
              </th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">
                Precio unit.
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">
                Desde
              </th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map((a) => (
              <tr
                key={a.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td data-label="Ingrediente" className="px-5 py-3 font-medium text-gray-800">
                  {a.ingrediente_nombre}
                  {a.unidad_medida && (
                    <span className="text-gray-400 font-normal">
                      {" "}
                      ({a.unidad_medida})
                    </span>
                  )}
                </td>
                <td data-label="Localidad" className="px-5 py-3 text-gray-600">
                  {a.localidad_nombre}
                </td>
                <td data-label="Proveedor" className="px-5 py-3 text-gray-600">
                  {a.proveedor_nombre}
                </td>
                <td data-label="Precio unitario" className="px-5 py-3 text-right text-gray-800">
                  {formatMoney(a.precio_unitario)}
                </td>
                <td data-label="Desde" className="px-5 py-3 text-gray-600 hidden md:table-cell">
                  {fmtFecha(a.fecha_desde)}
                </td>
                <td data-label="Acciones" className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Editar precio
                    </button>
                    <button
                      onClick={() => openHistorial(a)}
                      className="text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      Historial
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {asignaciones.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-gray-400"
                >
                  No hay asignaciones vigentes con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableState>

      {/* Modal crear */}
      <CrudFormModal
        open={createOpen}
        title="Asignar ingrediente a localidades"
        error={formError}
        saving={saving}
        onClose={() => { if (!saving) setCreateOpen(false); }}
        onSubmit={handleCreate}
        width="max-w-2xl"
        submitLabel={cLocalidades.length > 0
          ? `Guardar en ${cLocalidades.length} ${cLocalidades.length === 1 ? "localidad" : "localidades"}`
          : "Guardar asignaciones"}
        submitDisabled={localidadesActivas.length === 0}
      >
        <p className="text-sm text-gray-500 mb-5">
          Elegí el ingrediente y el proveedor una sola vez. Marcá las localidades
          donde lo vas a cargar y completá el precio de cada una.
        </p>
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-70">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="asignacion-ingrediente" className="block text-sm font-medium text-gray-700 mb-1">
                Ingrediente
              </label>
              <select
                id="asignacion-ingrediente"
                value={cIngrediente}
                onChange={(e) => {
                  setCIngrediente(e.target.value);
                  setFormError(null);
                }}
                className={`w-full ${selectCls}`}
                autoFocus
              >
                <option value="">Seleccionar...</option>
                {ingredientes
                  .filter((i) => i.activo)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad_medida})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="asignacion-proveedor" className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor
              </label>
              <select
                id="asignacion-proveedor"
                value={cProveedor}
                onChange={(e) => {
                  setCProveedor(e.target.value);
                  setFormError(null);
                }}
                className={`w-full ${selectCls}`}
              >
                <option value="">Seleccionar...</option>
                {proveedores
                  .filter((p) => p.activo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Localidades y precios</h3>
                <p className="text-xs text-gray-500 mt-0.5" aria-live="polite">
                  {cLocalidades.length} de {localidadesActivas.length} seleccionadas
                  {unidadPrecio && ` · Precio en $ por ${unidadPrecio}`}
                </p>
              </div>
              {localidadesActivas.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCLocalidades(allSelected ? [] : localidadesActivas.map((l) => l.id));
                    setFormError(null);
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 rounded-lg px-2 py-1"
                >
                  {allSelected ? "Desmarcar todas" : "Seleccionar todas"}
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {localidadesActivas.map((localidad) => {
                const selected = cLocalidades.includes(localidad.id);
                return (
                  <div key={localidad.id} className={`grid grid-cols-1 sm:grid-cols-[1fr_12rem] items-center gap-2 sm:gap-4 px-4 py-3 ${selected ? "bg-blue-50/50" : "bg-white"}`}>
                    <label className="flex items-center gap-3 text-sm font-medium text-gray-800 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          setCLocalidades((ids) => selected
                            ? ids.filter((id) => id !== localidad.id)
                            : [...ids, localidad.id]);
                          setFormError(null);
                        }}
                        className="h-4 w-4 accent-blue-600 shrink-0"
                      />
                      {localidad.nombre}
                    </label>
                    <div className="relative ml-7 sm:ml-0">
                      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                      <input
                        id={`precio-localidad-${localidad.id}`}
                        aria-label={`Precio unitario en ${localidad.nombre}`}
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max="9999999999.99"
                        step="0.01"
                        disabled={!selected}
                        value={cPrecios[localidad.id] ?? ""}
                        onChange={(e) => {
                          setCPrecios((precios) => ({ ...precios, [localidad.id]: e.target.value }));
                          setFormError(null);
                        }}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                        placeholder={selected ? "Ej: 1900.00" : "Marcá la localidad"}
                      />
                    </div>
                  </div>
                );
              })}
              {localidadesActivas.length === 0 && (
                <p className="px-4 py-5 text-sm text-gray-500">No hay localidades activas. Creá o activá una en Localidades para continuar.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-3 items-end">
            <div>
              <label htmlFor="asignacion-fecha" className="block text-sm font-medium text-gray-700 mb-1">Vigente desde</label>
              <input
                id="asignacion-fecha"
                type="date"
                value={cFecha}
                onChange={(e) => {
                  setCFecha(e.target.value);
                  setFormError(null);
                }}
                className={`w-full ${selectCls}`}
              />
            </div>
            <p className="text-xs text-gray-500 pb-2">Se aplica a todas las localidades seleccionadas. Si dejás la fecha vacía, se usa hoy.</p>
          </div>
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Si ya existe una asignación vigente, se reemplaza en esa localidad y la anterior queda en el historial.
          </p>
        </fieldset>
      </CrudFormModal>

      {/* Modal editar precio */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              Editar precio
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {editTarget.ingrediente_nombre} · {editTarget.localidad_nombre} ·{" "}
              {editTarget.proveedor_nombre}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio unitario
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editPrecio}
              onChange={(e) => setEditPrecio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {editError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                {editError}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                disabled={editSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {editSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {histTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Historial</h2>
            <p className="text-sm text-gray-500 mb-4">
              {histTarget.ingrediente_nombre} · {histTarget.localidad_nombre}
            </p>
            {histLoading ? (
              <p className="text-gray-400 text-sm py-4">Cargando...</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Tramos de proveedor
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left py-2 font-medium">Proveedor</th>
                      <th className="text-right py-2 font-medium">Precio</th>
                      <th className="text-left py-2 pl-3 font-medium">Desde</th>
                      <th className="text-left py-2 font-medium">Hasta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h) => (
                      <tr key={h.id} className="border-b border-gray-50">
                        <td className="py-2 text-gray-800">
                          {h.proveedor_nombre}
                          {h.vigente && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              vigente
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-gray-700">
                          {formatMoney(h.precio_unitario)}
                        </td>
                        <td className="py-2 pl-3 text-gray-600">
                          {fmtFecha(h.fecha_desde)}
                        </td>
                        <td className="py-2 text-gray-600">
                          {fmtFecha(h.fecha_hasta)}
                        </td>
                      </tr>
                    ))}
                    {historial.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-6 text-center text-gray-400"
                        >
                          Sin historial.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-2">
                  Cambios de precio
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left py-2 font-medium">Fecha</th>
                      <th className="text-left py-2 font-medium">Usuario</th>
                      <th className="text-right py-2 font-medium">Anterior</th>
                      <th className="text-right py-2 pl-3 font-medium">
                        Nuevo
                      </th>
                      <th className="text-right py-2 font-medium">
                        Variación
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {precioHistorial.map((c) => {
                      const bajo = Number(c.variacion) < 0;
                      return (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2 text-gray-600 whitespace-nowrap">
                            {formatDate(c.modificado_at)}
                          </td>
                          <td className="py-2 text-gray-800">
                            {c.modificado_por_username ?? "—"}
                          </td>
                          <td className="py-2 text-right text-gray-500 line-through">
                            {formatMoney(c.precio_anterior)}
                          </td>
                          <td className="py-2 text-right pl-3 text-gray-800 font-medium">
                            {formatMoney(c.precio_nuevo)}
                          </td>
                          <td className="py-2 text-right">
                            <span
                              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                bajo
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {bajo ? "−" : "+"}
                              {formatMoney(
                                Math.abs(Number(c.variacion)),
                              )}
                              {c.variacion_pct !== null && (
                                <span className="ml-1">
                                  (
                                  {Number(c.variacion_pct) > 0 ? "+" : ""}
                                  {Number(c.variacion_pct).toLocaleString(
                                    "es-AR",
                                    { maximumFractionDigits: 2 },
                                  )}
                                  %)
                                </span>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {precioHistorial.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-gray-400"
                        >
                          El precio nunca fue editado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setHistTarget(null)}
                className="border border-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
