import { clearAccessToken, getAccessToken, setAccessToken } from "./auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  return res;
}

let _refreshPromise: Promise<boolean> | null = null;

export async function tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      clearAccessToken();
      return false;
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    return true;
  }).finally(() => {
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
  if (!res.ok) throw new Error("No autenticado");
  return res.json();
}

// ── Users CRUD (admin only) ──────────────────────────────────────────────────

export interface UserRecord {
  id: number;
  username: string;
  role: "admin" | "gestor" | "escuela";
  school_id: number | null;
  active: boolean;
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
  if (!res.ok) throw new Error("Error al cambiar estado del usuario");
  return res.json();
}

// ── Localidades CRUD (admin write, admin+gestor read) ────────────────────────

export interface LocalidadRecord {
  id: number;
  nombre: string;
  activo: boolean;
}

export async function apiGetLocalidades(): Promise<LocalidadRecord[]> {
  const res = await apiFetch("/localidades");
  if (!res.ok) throw new Error("Error al obtener localidades");
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
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al crear localidad");
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
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al actualizar localidad");
  }
  return res.json();
}

export async function apiToggleLocalidadActive(
  id: number,
): Promise<LocalidadRecord> {
  const res = await apiFetch(`/localidades/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Error al cambiar estado de la localidad");
  return res.json();
}

// ── Schools CRUD (admin + gestor) ────────────────────────────────────────────

export interface SchoolRecord {
  id: number;
  name: string;
  code: string;
  locality_id: number;
  locality_name: string;
  matriculation: number;
  offers_breakfast: boolean;
  offers_lunch: boolean;
  offers_snack: boolean;
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
  matriculation?: number;
  offers_breakfast?: boolean;
  offers_lunch?: boolean;
  offers_snack?: boolean;
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
    matriculation?: number;
    offers_breakfast?: boolean;
    offers_lunch?: boolean;
    offers_snack?: boolean;
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

// ── Ingredientes CRUD (admin write, admin+gestor read) ───────────────────────

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
