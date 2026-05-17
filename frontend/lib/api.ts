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

// Returns true if a new access token was obtained.
export async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    clearAccessToken();
    return false;
  }
  const data = await res.json();
  setAccessToken(data.access_token);
  return true;
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
