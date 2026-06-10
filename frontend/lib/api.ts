import { clearAccessToken, getAccessToken, setAccessToken } from "./auth";

import { notifyAuthExpired } from "./auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function buildApiError(res: Response, fallback: string): Promise<Error> {
  if (res.status === 401) {
    return new Error("Sesion expirada o no autorizada. Volve a iniciar sesion.");
  }

  const data = await res.json().catch(() => null);
  const detail =
    data && typeof data === "object" && "detail" in data
      ? String((data as { detail: unknown }).detail)
      : null;
  return new Error(detail || fallback);
}

export interface UserInfo {
  id: number;
  username: string;
  role: "admin" | "gestor" | "escuela";
  school_id: number | null;
}

// Wraps fetch: attaches Bearer token, retries once after a transparent refresh.
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const doRequest = (token: string | null) => {
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  };

  let res = await doRequest(getAccessToken());

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doRequest(getAccessToken());
    }
  }

  if (res.status === 401) {
    notifyAuthExpired();
  }

  return res;
}

let _refreshPromise: Promise<boolean> | null = null;

export async function tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (res) => {
      if (!res.ok) {
        notifyAuthExpired();
        return false;
      }
      const data = await res.json();
      setAccessToken(data.access_token);
      return true;
    })
    .catch(() => {
      clearAccessToken();
      return false;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

export async function apiLogin(
  username: string,
  password: string,
): Promise<{ access_token: string; user: UserInfo }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al iniciar sesión");
  }
  return res.json();
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  clearAccessToken();
}

export async function apiGetMe(): Promise<UserInfo> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) throw await buildApiError(res, "No autenticado");
  return res.json();
}

// â”€â”€ Users CRUD (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface UserRecord {
  id: number;
  username: string;
  role: "admin" | "gestor" | "escuela";
  school_id: number | null;
  active: boolean;
  is_protected_admin: boolean;
}

export async function apiGetUsers(): Promise<UserRecord[]> {
  const res = await apiFetch("/users");
  if (!res.ok) throw new Error("Error al obtener usuarios");
  return res.json();
}

export async function apiCreateUser(data: {
  username: string;
  password: string;
  role: string;
  school_id?: number | null;
}): Promise<UserRecord> {
  const res = await apiFetch("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al crear usuario");
  }
  return res.json();
}

export async function apiUpdateUser(
  id: number,
  data: {
    username?: string;
    password?: string;
    role?: string;
    school_id?: number | null;
  },
): Promise<UserRecord> {
  const res = await apiFetch(`/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al actualizar usuario");
  }
  return res.json();
}

export async function apiToggleUserActive(id: number): Promise<UserRecord> {
  const res = await apiFetch(`/users/${id}/toggle-active`, { method: "PATCH" });
  if (!res.ok) throw await buildApiError(res, "Error al cambiar estado del usuario");
  return res.json();
}

// â”€â”€ Localidades CRUD (admin write, admin+gestor read) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface LocalidadRecord {
  id: number;
  nombre: string;
  activo: boolean;
}

export async function apiGetLocalidades(): Promise<LocalidadRecord[]> {
  const res = await apiFetch("/localidades");
  if (!res.ok) throw await buildApiError(res, "Error al obtener localidades");
  return res.json();
}

export async function apiCreateLocalidad(
  nombre: string,
): Promise<LocalidadRecord> {
  const res = await apiFetch("/localidades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });
  if (!res.ok) {
    throw await buildApiError(res, "Error al crear localidad");
  }
  return res.json();
}

export async function apiUpdateLocalidad(
  id: number,
  nombre: string,
): Promise<LocalidadRecord> {
  const res = await apiFetch(`/localidades/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });
  if (!res.ok) {
    throw await buildApiError(res, "Error al actualizar localidad");
  }
  return res.json();
}

export async function apiToggleLocalidadActive(
  id: number,
): Promise<LocalidadRecord> {
  const res = await apiFetch(`/localidades/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) throw await buildApiError(res, "Error al cambiar estado de la localidad");
  return res.json();
}

// â”€â”€ Schools CRUD (admin + gestor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Proveedores CRUD (admin only)
export interface ProveedorRecord {
  id: number;
  nombre: string;
  contacto: string;
  activo: boolean;
}

export async function apiGetProveedores(): Promise<ProveedorRecord[]> {
  const res = await apiFetch("/proveedores");
  if (!res.ok) throw await buildApiError(res, "Error al obtener proveedores");
  return res.json();
}

export async function apiCreateProveedor(data: {
  nombre: string;
  contacto: string;
}): Promise<ProveedorRecord> {
  const res = await apiFetch("/proveedores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw await buildApiError(res, "Error al crear proveedor");
  }
  return res.json();
}

export async function apiUpdateProveedor(
  id: number,
  data: {
    nombre: string;
    contacto: string;
  },
): Promise<ProveedorRecord> {
  const res = await apiFetch(`/proveedores/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw await buildApiError(res, "Error al actualizar proveedor");
  }
  return res.json();
}

export async function apiToggleProveedorActive(
  id: number,
): Promise<ProveedorRecord> {
  const res = await apiFetch(`/proveedores/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) throw await buildApiError(res, "Error al cambiar estado del proveedor");
  return res.json();
}

export interface SchoolRecord {
  id: number;
  name: string;
  code: string;
  locality_id: number;
  locality_name: string;
  address: string;
  phone: string;
  matriculation: number;
  offers_breakfast: boolean;
  offers_lunch: boolean;
  offers_snack: boolean;
  offers_dinner: boolean;
  active: boolean;
}

export async function apiGetSchools(
  locality_id?: number,
): Promise<SchoolRecord[]> {
  const params = locality_id ? `?locality_id=${locality_id}` : "";
  const res = await apiFetch(`/schools${params}`);
  if (!res.ok) throw new Error("Error al obtener escuelas");
  return res.json();
}

export async function apiGetSchool(id: number): Promise<SchoolRecord> {
  const res = await apiFetch(`/schools/${id}`);
  if (!res.ok) throw new Error("Error al obtener escuela");
  return res.json();
}

export async function apiCreateSchool(data: {
  name: string;
  code: string;
  locality_id: number;
  address: string;
  phone: string;
  matriculation?: number;
  offers_breakfast?: boolean;
  offers_lunch?: boolean;
  offers_snack?: boolean;
  offers_dinner?: boolean;
}): Promise<SchoolRecord> {
  const res = await apiFetch("/schools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al crear escuela");
  }
  return res.json();
}

export async function apiUpdateSchool(
  id: number,
  data: {
    name?: string;
    code?: string;
    locality_id?: number;
    address?: string;
    phone?: string;
    matriculation?: number;
    offers_breakfast?: boolean;
    offers_lunch?: boolean;
    offers_snack?: boolean;
    offers_dinner?:boolean;
    active?: boolean;
  },
): Promise<SchoolRecord> {
  const res = await apiFetch(`/schools/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al actualizar escuela");
  }
  return res.json();
}

export async function apiToggleSchoolActive(
  id: number,
): Promise<SchoolRecord> {
  const res = await apiFetch(`/schools/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Error al cambiar estado de la escuela");
  return res.json();
}

export async function apiGetMySchool(): Promise<SchoolRecord> {
  const res = await apiFetch("/schools/me");
  if (!res.ok) throw await buildApiError(res, "Error al obtener la escuela asociada");
  return res.json();
}

export async function apiUpdateMySchoolMatriculation(
  matriculation: number,
): Promise<SchoolRecord> {
  const res = await apiFetch("/schools/me/matriculation", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matriculation }),
  });
  if (!res.ok) throw await buildApiError(res, "Error al actualizar la matricula");
  return res.json();
}

export interface StockPrevioItem {
  ingrediente_id: number;
  ingrediente_nombre: string;
  unidad_medida: string;
  cantidad: string;
  cargado_at: string | null;
}

export interface StockPrevioSchoolRecord {
  escuela_id: number;
  escuela_nombre: string;
  items: StockPrevioItem[];
}

export async function apiGetMyStock(): Promise<StockPrevioSchoolRecord> {
  const res = await apiFetch("/stock-previo/me");
  if (!res.ok) throw await buildApiError(res, "Error al obtener el stock sobrante");
  return res.json();
}

export async function apiUpdateMyStock(
  items: Array<{ ingrediente_id: number; cantidad: number }>,
): Promise<StockPrevioSchoolRecord> {
  const res = await apiFetch("/stock-previo/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw await buildApiError(res, "Error al actualizar el stock sobrante");
  return res.json();
}

export async function apiGetSchoolStock(
  schoolId: number,
): Promise<StockPrevioSchoolRecord> {
  const res = await apiFetch(`/stock-previo/${schoolId}`);
  if (!res.ok) throw await buildApiError(res, "Error al obtener el stock de la escuela");
  return res.json();
}

export async function apiUpdateSchoolStock(
  schoolId: number,
  items: Array<{ ingrediente_id: number; cantidad: number }>,
): Promise<StockPrevioSchoolRecord> {
  const res = await apiFetch(`/stock-previo/${schoolId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw await buildApiError(res, "Error al actualizar el stock de la escuela");
  return res.json();
}

// â”€â”€ Ingredientes CRUD (admin write, admin+gestor read) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface IngredienteRecord {
  id: number;
  nombre: string;
  unidad_medida: string;
  contenido_por_unidad: number | null;
  unidad_contenido: string | null;
  indice_correccion: number;
  activo: boolean;
}

export async function apiGetIngredientes(
  includeInactive = false,
): Promise<IngredienteRecord[]> {
  const query = includeInactive ? "?include_inactive=true" : "";
  const res = await apiFetch(`/ingredientes${query}`);
  if (!res.ok) throw new Error("Error al obtener ingredientes");
  return res.json();
}

export async function apiCreateIngrediente(data: {
  nombre: string;
  unidad_medida: string;
  contenido_por_unidad?: number | null;
  unidad_contenido?: string | null;
  indice_correccion?: number;
}): Promise<IngredienteRecord> {
  const res = await apiFetch("/ingredientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al crear ingrediente");
  }
  return res.json();
}

export async function apiUpdateIngrediente(
  id: number,
  data: {
    nombre: string;
    unidad_medida: string;
    contenido_por_unidad?: number | null;
    unidad_contenido?: string | null;
    indice_correccion?: number;
  },
): Promise<IngredienteRecord> {
  const res = await apiFetch(`/ingredientes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al actualizar ingrediente");
  }
  return res.json();
}

export async function apiToggleIngredienteActive(
  id: number,
): Promise<IngredienteRecord> {
  const res = await apiFetch(`/ingredientes/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Error al cambiar estado del ingrediente");
  return res.json();
}

// ── Temporadas y opciones de menú (admin only) ───────────────────────────────

export interface OpcionMenuRecord {
  id: number;
  numero_opcion: 1 | 2;
  descripcion: string | null;
}

export interface TemporadaRecord {
  id: number;
  nombre: "VERANO" | "INVIERNO";
  anio: number;
  activo: boolean;
  opciones_menu: OpcionMenuRecord[];
}

export async function apiGetTemporadas(
  includeInactive = false,
): Promise<TemporadaRecord[]> {
  const query = includeInactive ? "?include_inactive=true" : "";
  const res = await apiFetch(`/temporadas${query}`);
  if (!res.ok) throw await buildApiError(res, "Error al obtener temporadas");
  return res.json();
}

export async function apiGetTemporadaActiva(): Promise<TemporadaRecord> {
  const res = await apiFetch("/temporadas/active");
  if (!res.ok) throw await buildApiError(res, "Error al obtener la temporada activa");
  return res.json();
}

export async function apiCreateTemporada(data: {
  nombre: "VERANO" | "INVIERNO";
  anio: number;
  activo: boolean;
}): Promise<TemporadaRecord> {
  const res = await apiFetch("/temporadas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al crear temporada");
  return res.json();
}

export async function apiUpdateTemporada(
  id: number,
  data: {
    nombre: "VERANO" | "INVIERNO";
    anio: number;
    activo: boolean;
  },
): Promise<TemporadaRecord> {
  const res = await apiFetch(`/temporadas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al actualizar temporada");
  return res.json();
}

export async function apiToggleTemporadaActive(
  id: number,
): Promise<TemporadaRecord> {
  const res = await apiFetch(`/temporadas/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) {
    throw await buildApiError(res, "Error al cambiar el estado de la temporada");
  }
  return res.json();
}

export async function apiUpdateTemporadaOpciones(
  id: number,
  opciones: Array<{ numero_opcion: 1 | 2; descripcion: string | null }>,
): Promise<TemporadaRecord> {
  const res = await apiFetch(`/temporadas/${id}/opciones`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opciones }),
  });
  if (!res.ok) {
    throw await buildApiError(res, "Error al guardar los menús de la temporada");
  }
  return res.json();
}

// ── Grilla semanal de menú (admin only) ─────────────────────────────────────

export interface DiaMenuRecord {
  id: number;
  opcion_menu_id: number;
  dia_semana: number;
  tipo_comida: TipoComida;
  receta_id: number;
  receta_nombre: string;
}

export interface OpcionMenuWithDiasRecord extends OpcionMenuRecord {
  dias_menu: DiaMenuRecord[];
}

export interface TemporadaMenuRecord {
  temporada_id: number;
  opciones: OpcionMenuWithDiasRecord[];
}

export async function apiGetTemporadaMenu(
  temporadaId: number,
): Promise<TemporadaMenuRecord> {
  const res = await apiFetch(`/temporadas/${temporadaId}/menu`);
  if (!res.ok) throw await buildApiError(res, "Error al obtener el menu");
  return res.json();
}

export async function apiUpdateTemporadaMenu(
  temporadaId: number,
  items: Array<{
    opcion_menu_id: number;
    dia_semana: number;
    tipo_comida: TipoComida;
    receta_id: number;
  }>,
): Promise<TemporadaMenuRecord> {
  const res = await apiFetch(`/temporadas/${temporadaId}/menu`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw await buildApiError(res, "Error al guardar el menu");
  return res.json();
}

// ── Recetas (admin only) ─────────────────────────────────────────────────────

export type TipoComida = "DESAYUNO" | "ALMUERZO" | "MERIENDA";

export interface RecetaIngredienteRecord {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string;
  unidad_medida: string;
  cantidad_por_porcion: number;
}

export interface RecetaRecord {
  id: number;
  nombre: string;
  tipo_comida: TipoComida;
  temporada_id: number | null;
  temporada_nombre: "VERANO" | "INVIERNO" | null;
  temporada_anio: number | null;
  activo: boolean;
  ingredientes: RecetaIngredienteRecord[];
}

export async function apiGetRecetas(
  includeInactive = false,
): Promise<RecetaRecord[]> {
  const query = includeInactive ? "?include_inactive=true" : "";
  const res = await apiFetch(`/recetas${query}`);
  if (!res.ok) throw await buildApiError(res, "Error al obtener recetas");
  return res.json();
}

export async function apiCreateReceta(data: {
  nombre: string;
  tipo_comida: TipoComida;
  temporada_id: number;
  ingredientes: Array<{ ingrediente_id: number; cantidad_por_porcion: number }>;
}): Promise<RecetaRecord> {
  const res = await apiFetch("/recetas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al crear receta");
  return res.json();
}

export async function apiUpdateReceta(
  id: number,
  data: {
    nombre: string;
    tipo_comida: TipoComida;
    temporada_id: number;
    ingredientes: Array<{ ingrediente_id: number; cantidad_por_porcion: number }>;
  },
): Promise<RecetaRecord> {
  const res = await apiFetch(`/recetas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al actualizar receta");
  return res.json();
}

export async function apiToggleRecetaActive(id: number): Promise<RecetaRecord> {
  const res = await apiFetch(`/recetas/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) throw await buildApiError(res, "Error al cambiar estado de la receta");
  return res.json();
}

// ── Asignaciones proveedor-ingrediente-localidad (admin only) ────────────────

export interface AsignacionRecord {
  id: number;
  proveedor_id: number;
  ingrediente_id: number;
  localidad_id: number;
  precio_unitario: string;
  fecha_desde: string;
  fecha_hasta: string | null;
  vigente: boolean;
  proveedor_nombre: string | null;
  ingrediente_nombre: string | null;
  localidad_nombre: string | null;
  unidad_medida: string | null;
}

export async function apiGetAsignaciones(filters?: {
  ingrediente_id?: number;
  localidad_id?: number;
  proveedor_id?: number;
  solo_vigentes?: boolean;
}): Promise<AsignacionRecord[]> {
  const params = new URLSearchParams();
  if (filters?.ingrediente_id != null)
    params.set("ingrediente_id", String(filters.ingrediente_id));
  if (filters?.localidad_id != null)
    params.set("localidad_id", String(filters.localidad_id));
  if (filters?.proveedor_id != null)
    params.set("proveedor_id", String(filters.proveedor_id));
  if (filters?.solo_vigentes != null)
    params.set("solo_vigentes", String(filters.solo_vigentes));
  const qs = params.toString();
  const res = await apiFetch(`/asignaciones${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw await buildApiError(res, "Error al obtener asignaciones");
  return res.json();
}

export async function apiGetAsignacionHistorial(
  ingrediente_id: number,
  localidad_id: number,
): Promise<AsignacionRecord[]> {
  const res = await apiFetch(
    `/asignaciones/historial?ingrediente_id=${ingrediente_id}&localidad_id=${localidad_id}`,
  );
  if (!res.ok) throw await buildApiError(res, "Error al obtener el historial");
  return res.json();
}

export async function apiCreateAsignacion(data: {
  proveedor_id: number;
  ingrediente_id: number;
  localidad_id: number;
  precio_unitario: number;
  fecha_desde?: string | null;
}): Promise<AsignacionRecord> {
  const res = await apiFetch("/asignaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al crear la asignación");
  return res.json();
}

export async function apiUpdateAsignacionPrecio(
  id: number,
  precio_unitario: number,
): Promise<AsignacionRecord> {
  const res = await apiFetch(`/asignaciones/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ precio_unitario }),
  });
  if (!res.ok) throw await buildApiError(res, "Error al actualizar el precio");
  return res.json();
}

// ── Pedidos (admin + gestor) ────────────────────────────────────────────────

export interface PedidoSnapshot {
  semana_inicio: string;
  dias_habiles: number[];
  opcion_menu: {
    id: number;
    numero_opcion: number;
    descripcion: string | null;
    temporada: { id: number | null; nombre: string | null; anio: number | null };
  };
  proveedores: Array<{
    proveedor_id: number;
    proveedor_nombre: string;
    localidad_id: number;
    localidad_nombre: string;
    ingredientes: Array<{
      ingrediente_id: number;
      ingrediente_nombre: string;
      unidad: string;
      contenido_por_unidad?: string | null;
      unidad_contenido?: string | null;
      precio_unitario: string;
      cantidad_total: string;
      cantidad_contenido_total?: string | null;
      costo_total: string;
      escuelas: Array<{
        escuela_id: number;
        escuela_codigo: string;
        escuela_nombre: string;
        cantidad: string;
        cantidad_contenido?: string | null;
      }>;
    }>;
  }>;
  escuelas: Array<{
    escuela_id: number;
    codigo: string;
    nombre: string;
    localidad_id: number;
    localidad_nombre: string;
    matricula: number;
    ingredientes: Array<{
      ingrediente_id: number;
      ingrediente_nombre: string;
      unidad_calculo: string;
      unidad_final: string;
      cantidad_base: string;
      cantidad_corregida: string;
      stock_descontado: string;
      cantidad_neta: string;
      cantidad_final: string;
      contenido_por_unidad?: string | null;
      unidad_contenido?: string | null;
      cantidad_contenido_final?: string | null;
      proveedor_id?: number;
      proveedor_nombre?: string;
      localidad_id?: number;
      localidad_nombre?: string;
      precio_unitario?: string;
      costo_total?: string;
    }>;
  }>;
  resumen_global: Array<{
    ingrediente_id: number;
    ingrediente_nombre: string;
    unidad: string;
    contenido_por_unidad?: string | null;
    unidad_contenido?: string | null;
    localidad_id?: number;
    localidad_nombre: string;
    proveedor_id?: number;
    proveedor_nombre: string;
    precio_unitario: string;
    cantidad_total: string;
    cantidad_contenido_total?: string | null;
    costo_total: string;
  }>;
  advertencias: Array<{
    tipo: string;
    escuela_id?: number;
    escuela_nombre: string;
    localidad_id?: number;
    localidad_nombre: string;
    ingrediente_id?: number;
    ingrediente_nombre: string;
  }>;
  costo_total: string;
}

export interface PedidoRecord {
  id: number;
  semana_inicio: string;
  opcion_menu_id: number;
  dias_habiles: number[];
  generado_por_id: number;
  generado_at: string;
  notas: string | null;
  datos_snapshot: PedidoSnapshot;
}

export async function apiPreviewPedido(data: {
  semana_inicio: string;
  opcion_menu_id: number;
  dias_habiles: number[];
  stock_overrides?: Array<{ escuela_id: number; ingrediente_id: number; cantidad: number }>;
  notas?: string | null;
}): Promise<PedidoSnapshot> {
  const res = await apiFetch("/pedidos/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al previsualizar pedido");
  const payload = await res.json();
  return payload.snapshot;
}

export async function apiConfirmPedido(data: {
  semana_inicio: string;
  opcion_menu_id: number;
  dias_habiles: number[];
  stock_overrides?: Array<{ escuela_id: number; ingrediente_id: number; cantidad: number }>;
  notas?: string | null;
}): Promise<PedidoRecord> {
  const res = await apiFetch("/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await buildApiError(res, "Error al confirmar pedido");
  return res.json();
}

export async function apiGetPedidos(): Promise<PedidoRecord[]> {
  const res = await apiFetch("/pedidos");
  if (!res.ok) throw await buildApiError(res, "Error al obtener pedidos");
  return res.json();
}

export async function apiDownloadPedidoExport(
  id: number,
  format: "pdf" | "excel",
  scope: "resumen" | "proveedores" | "localidades" | "escuelas" = "resumen",
  filters?: {
    localidad_id?: number | null;
    proveedor_id?: number | null;
    escuela_id?: number | null;
  },
): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters?.localidad_id) params.set("localidad_id", String(filters.localidad_id));
  if (filters?.proveedor_id) params.set("proveedor_id", String(filters.proveedor_id));
  if (filters?.escuela_id) params.set("escuela_id", String(filters.escuela_id));
  const query = params.toString();
  const basePath =
    scope === "proveedores"
      ? `/pedidos/${id}/export/proveedores/${format}`
      : scope === "localidades"
        ? `/pedidos/${id}/export/localidades/${format}`
        : scope === "escuelas"
          ? `/pedidos/${id}/export/escuelas/${format}`
          : `/pedidos/${id}/export/${format}`;
  const path = `${basePath}${query ? `?${query}` : ""}`;
  const res = await apiFetch(path);
  if (!res.ok) throw await buildApiError(res, "Error al descargar el pedido");
  return res.blob();
}

