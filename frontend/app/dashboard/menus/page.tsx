"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/dashboard/user-context";
import {
  apiGetRecetas,
  apiGetTemporadaMenu,
  apiGetTemporadas,
  apiGetTiposComida,
  apiUpdateTemporadaMenu,
  type OpcionMenuWithDiasRecord,
  type RecetaRecord,
  type TemporadaRecord,
  type TipoComidaRecord,
} from "@/lib/api";
import { showSuccessToast } from "@/components/toast";

const DAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miercoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
];

type SelectionMap = Record<string, string>;

function slotKey(opcionId: number, dia: number, tipoId: number): string {
  return `${opcionId}:${dia}:${tipoId}`;
}

function seasonLabel(temporada: TemporadaRecord): string {
  return `${temporada.nombre === "VERANO" ? "Verano" : "Invierno"} ${temporada.anio}`;
}

export default function MenusPage() {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const [temporadas, setTemporadas] = useState<TemporadaRecord[]>([]);
  const [selectedTemporada, setSelectedTemporada] = useState("");
  const [recetas, setRecetas] = useState<RecetaRecord[]>([]);
  const [tiposComida, setTiposComida] = useState<TipoComidaRecord[]>([]);
  const [opciones, setOpciones] = useState<OpcionMenuWithDiasRecord[]>([]);
  const [selection, setSelection] = useState<SelectionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [temporadasData, recetasData, tiposData] = await Promise.all([
          apiGetTemporadas(true),
          apiGetRecetas(),
          apiGetTiposComida(),
        ]);
        setTemporadas(temporadasData);
        setRecetas(recetasData);
        setTiposComida(tiposData);
        const active = temporadasData.find((temporada) => temporada.activo) ?? temporadasData[0];
        if (active) setSelectedTemporada(String(active.id));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar menus");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTemporada) {
      setOpciones([]);
      setSelection({});
      return;
    }

    (async () => {
      setError(null);
      try {
        const menu = await apiGetTemporadaMenu(Number(selectedTemporada));
        setOpciones(menu.opciones);
        const nextSelection: SelectionMap = {};
        for (const opcion of menu.opciones) {
          for (const dia of opcion.dias_menu) {
            nextSelection[slotKey(opcion.id, dia.dia_semana, dia.tipo_comida_id)] = String(dia.receta_id);
          }
        }
        setSelection(nextSelection);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar la grilla");
      }
    })();
  }, [selectedTemporada]);

  const selectedSeason = useMemo(
    () => temporadas.find((temporada) => String(temporada.id) === selectedTemporada),
    [temporadas, selectedTemporada],
  );

  const recetasByMeal = useMemo(() => {
    const temporadaId = Number(selectedTemporada);
    return Object.fromEntries(
      tiposComida.map((tipo) => [
        tipo.id,
        recetas.filter(
          (receta) =>
            receta.activo &&
            receta.temporada_id === temporadaId &&
            receta.tipos_comida.some((t) => t.id === tipo.id),
        ),
      ]),
    ) as Record<number, RecetaRecord[]>;
  }, [recetas, tiposComida, selectedTemporada]);

  function setSlot(opcionId: number, dia: number, tipoId: number, recetaId: string) {
    setSelection((current) => ({
      ...current,
      [slotKey(opcionId, dia, tipoId)]: recetaId,
    }));
  }

  async function saveMenu() {
    if (!selectedTemporada) return;

    const items = opciones.flatMap((opcion) =>
      DAYS.flatMap((day) =>
        tiposComida.flatMap((tipo) => {
          const recetaId = selection[slotKey(opcion.id, day.id, tipo.id)];
          return recetaId
            ? [
                {
                  opcion_menu_id: opcion.id,
                  dia_semana: day.id,
                  tipo_comida_id: tipo.id,
                  receta_id: Number(recetaId),
                },
              ]
            : [];
        }),
      ),
    );

    setSaving(true);
    setError(null);
    try {
      const updated = await apiUpdateTemporadaMenu(Number(selectedTemporada), items);
      setOpciones(updated.opciones);
      showSuccessToast("Menu guardado correctamente");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar el menu");
    } finally {
      setSaving(false);
    }
  }

  if (!user || loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No tenes permisos para administrar menus.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Menus semanales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Asignacion de recetas por opcion, dia y tipo de comida.
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedTemporada}
            onChange={(event) => setSelectedTemporada(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {temporadas.map((temporada) => (
              <option key={temporada.id} value={temporada.id}>
                {seasonLabel(temporada)}
              </option>
            ))}
          </select>
          <button
            onClick={saveMenu}
            disabled={saving || !selectedSeason}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? "Guardando..." : "Guardar menu"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {tiposComida.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          No hay tipos de comida activos. Creá al menos uno en la sección &quot;Tipos de comida&quot;.
        </p>
      )}

      {opciones.map((opcion) => (
        <section
          key={opcion.id}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">
              Opcion {opcion.numero_opcion}
            </h2>
            <p className="text-sm text-gray-500">{opcion.descripcion}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3 w-32">Dia</th>
                  {tiposComida.map((tipo) => (
                    <th key={tipo.id} className="text-left font-medium px-4 py-3">
                      {tipo.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {DAYS.map((day) => (
                  <tr key={day.id}>
                    <td className="px-4 py-3 font-medium text-gray-700">{day.label}</td>
                    {tiposComida.map((tipo) => (
                      <td key={tipo.id} className="px-4 py-3 min-w-64">
                        <select
                          value={selection[slotKey(opcion.id, day.id, tipo.id)] ?? ""}
                          onChange={(event) =>
                            setSlot(opcion.id, day.id, tipo.id, event.target.value)
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Sin receta</option>
                          {(recetasByMeal[tipo.id] ?? []).map((receta) => (
                            <option key={receta.id} value={receta.id}>
                              {receta.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
