// Fuente única de verdad para constantes de UI compartidas.
// Etiquetas en español conservadas textualmente (sin acentos como en las páginas originales).

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  escuela: "Escuela",
};

// DAYS unificado con doble forma.
// label = abreviado (pedidos), name = palabra completa (menus + pedidos).
export type DayDef = { id: number; label: string; name: string };

export const DAYS: DayDef[] = [
  { id: 1, label: "Lun", name: "Lunes" },
  { id: 2, label: "Mar", name: "Martes" },
  { id: 3, label: "Mie", name: "Miercoles" },
  { id: 4, label: "Jue", name: "Jueves" },
  { id: 5, label: "Vie", name: "Viernes" },
];
