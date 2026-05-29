"use client";

import { useEffect, useState } from "react";
import {
  apiCreateAsignacion,
  apiGetAsignaciones,
  apiGetAsignacionHistorial,
  apiGetIngredientes,
  apiGetLocalidades,
  apiGetProveedores,
  apiUpdateAsignacionPrecio,
  type AsignacionRecord,
  type IngredienteRecord,
  type LocalidadRecord,
  type ProveedorRecord,
} from "@/lib/api";
import { useUser } from "@/app/dashboard/user-context";

function fmtPrecio(v: string): string {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

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
  const [cLocalidad, setCLocalidad] = useState<string>("");
  const [cPrecio, setCPrecio] = useState<string>("");
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
  const [histLoading, setHistLoading] = useState(false);

  async function loadAsignaciones() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetAsignaciones({
        ingrediente_id: filterIngrediente ? Number(filterIngrediente) : undefined,
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
    setCProveedor("");
    setCIngrediente("");
    setCLocalidad("");
    setCPrecio("");
    setCFecha("");
    setFormError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setFormError(null);
    if (!cProveedor || !cIngrediente || !cLocalidad) {
      setFormError("Proveedor, ingrediente y localidad son obligatorios");
      return;
    }
    const precio = Number(cPrecio);
    if (!cPrecio || Number.isNaN(precio) || precio <= 0) {
      setFormError("El precio debe ser un número mayor a 0");
      return;
    }
    setSaving(true);
    try {
      await apiCreateAsignacion({
        proveedor_id: Number(cProveedor),
        ingrediente_id: Number(cIngrediente),
        localidad_id: Number(cLocalidad),
        precio_unitario: precio,
        fecha_desde: cFecha || null,
      });
      setCreateOpen(false);
      await loadAsignaciones();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al crear la asignación");
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
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Error al actualizar el precio");
    } finally {
      setEditSaving(false);
    }
  }

  async function openHistorial(a: AsignacionRecord) {
    setHistTarget(a);
    setHistorial([]);
    setHistLoading(true);
    try {
      setHistorial(await apiGetAsignacionHistorial(a.ingrediente_id, a.localidad_id));
    } catch {
      setHistorial([]);
    } finally {
      setHistLoading(false);
    }
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Asignaciones de proveedores
        </h1>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva asignación
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Quién provee cada ingrediente en cada localidad y a qué precio. Solo se
        muestran las asignaciones vigentes; crear una nueva cierra
        automáticamente la anterior de esa combinación.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}

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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Ingrediente</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Localidad</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Proveedor</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Precio unit.</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Desde</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {a.ingrediente_nombre}
                    {a.unidad_medida && (
                      <span className="text-gray-400 font-normal">
                        {" "}
                        ({a.unidad_medida})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{a.localidad_nombre}</td>
                  <td className="px-5 py-3 text-gray-600">{a.proveedor_nombre}</td>
                  <td className="px-5 py-3 text-right text-gray-800">
                    {fmtPrecio(a.precio_unitario)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{fmtFecha(a.fecha_desde)}</td>
                  <td className="px-5 py-3 text-right">
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
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    No hay asignaciones vigentes con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">Nueva asignación</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingrediente
                </label>
                <select
                  value={cIngrediente}
                  onChange={(e) => setCIngrediente(e.target.value)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localidad
                </label>
                <select
                  value={cLocalidad}
                  onChange={(e) => setCLocalidad(e.target.value)}
                  className={`w-full ${selectCls}`}
                >
                  <option value="">Seleccionar...</option>
                  {localidades
                    .filter((l) => l.activo)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor
                </label>
                <select
                  value={cProveedor}
                  onChange={(e) => setCProveedor(e.target.value)}
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
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio unitario
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cPrecio}
                    onChange={(e) => setCPrecio(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 1900.00"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha desde
                  </label>
                  <input
                    type="date"
                    value={cFecha}
                    onChange={(e) => setCFecha(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Vacío = hoy
                  </p>
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
                onClick={() => setCreateOpen(false)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar precio */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Editar precio</h2>
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
            <div className="flex gap-3 mt-6">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Historial</h2>
            <p className="text-sm text-gray-500 mb-4">
              {histTarget.ingrediente_nombre} · {histTarget.localidad_nombre}
            </p>
            {histLoading ? (
              <p className="text-gray-400 text-sm py-4">Cargando...</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
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
                          {fmtPrecio(h.precio_unitario)}
                        </td>
                        <td className="py-2 pl-3 text-gray-600">
                          {fmtFecha(h.fecha_desde)}
                        </td>
                        <td className="py-2 text-gray-600">{fmtFecha(h.fecha_hasta)}</td>
                      </tr>
                    ))}
                    {historial.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-400">
                          Sin historial.
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
